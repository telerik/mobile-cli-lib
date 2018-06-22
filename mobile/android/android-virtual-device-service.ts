import * as net from "net";
import * as path from "path";
import { EOL } from "os";
import * as osenv from "osenv";
import { AndroidVirtualDevice, DeviceTypes, NOT_RUNNING_EMULATOR_STATUS } from "../../constants";
import { cache } from "../../decorators";

export class AndroidVirtualDeviceService implements Mobile.IAndroidVirtualDeviceService {
	private androidHome: string;

	constructor(private $androidIniFileParser: Mobile.IAndroidIniFileParser,
		private $childProcess: IChildProcess,
		private $devicePlatformsConstants: Mobile.IDevicePlatformsConstants,
		private $emulatorHelper: Mobile.IEmulatorHelper,
		private $fs: IFileSystem,
		private $hostInfo: IHostInfo) {
			this.androidHome = process.env.ANDROID_HOME;
		}

	public async getAvailableEmulators(adbDevicesOutput: string[]): Promise<Mobile.IAvailableEmulatorsOutput> {
		const availableEmulatorsOutput = await this.getAvailableEmulatorsCore();
		const avds = availableEmulatorsOutput.devices;
		const runningEmulatorIds = await this.getRunningEmulatorIds(adbDevicesOutput);
		const runningEmulators = await Promise.all(runningEmulatorIds.map(emulatorId => this.getRunningEmulatorData(emulatorId, avds)));
		const devices = availableEmulatorsOutput.devices.map(emulator => this.$emulatorHelper.getEmulatorByImageIdentifier(emulator.imageIdentifier, runningEmulators) || emulator);
		return {
			devices,
			errors: availableEmulatorsOutput.errors
		};
	}

	public async getRunningEmulatorIds(adbDevicesOutput: string[]): Promise<string[]> {
		const emulatorIds = _.reduce(adbDevicesOutput, (result: string[], device: string) => {
			const rx = device.match(AndroidVirtualDevice.RUNNING_AVD_EMULATOR_REGEX);
			if (rx && rx[1]) {
				result.push(rx[1]);
			}

			return result;
		}, []);

		return emulatorIds;
	}

	public startEmulator(imageIdentifier: string): void {
		this.$childProcess.spawn(this.pathToEmulatorExecutable, ['-avd', imageIdentifier], { stdio: "ignore", detached: true }).unref();
	}

	private async getAvailableEmulatorsCore(): Promise<Mobile.IAvailableEmulatorsOutput> {
		let result: ISpawnResult = null;
		let devices: Mobile.IDeviceInfo[] = [];

		if (this.pathToVirtualDeviceManagerExecutable && this.$fs.exists(this.pathToVirtualDeviceManagerExecutable)) {
			result = await this.$childProcess.trySpawnFromCloseEvent(this.pathToVirtualDeviceManagerExecutable, ["list", "avds"]);
			if (result && result.stdout) {
				devices = this.parseListAvdsOutput(result.stdout);
			}
		} else {
			devices = this.listAvdsFromDirectory();
		}

		return { devices, errors: result && result.stderr ? [result.stderr] : [] };
	}

	private async getRunningEmulatorData(runningEmulatorId: string, availableEmulators: Mobile.IDeviceInfo[]): Promise<Mobile.IDeviceInfo> {
		const imageIdentifier = await this.getImageIdentifierFromRunningEmulator(runningEmulatorId);
		const runningEmulator = this.$emulatorHelper.getEmulatorByImageIdentifier(imageIdentifier, availableEmulators);
		if (!runningEmulator) {
			return null;
		}

		this.$emulatorHelper.setRunningAndroidEmulatorProperties(runningEmulatorId, runningEmulator);

		return runningEmulator;
	}

	private getImageIdentifierFromRunningEmulator(emulatorId: string): Promise<string> {
		const match = emulatorId.match(/^emulator-(\d+)/);
		const portNumber = match && match[1];
		if (!portNumber) {
			return Promise.resolve(null);
		}

		return new Promise<string>(resolve => {
			let isResolved = false;
			let output: string = "";
			const client = net.connect(portNumber, () => {
				client.write(`avd name${EOL}`);
			});

			client.on('data', data => {
				output += data.toString();

				const name = this.getImageIdentifierFromClientOutput(output);
				// old output should look like:
				// Android Console: type 'help' for a list of commands
				// OK
				// <Name of image>
				// OK
				// new output should look like:
				// Android Console: type 'help' for a list of commands
				// OK
				// a\u001b[K\u001b[Dav\u001b[K\u001b[D\u001b[Davd\u001b...
				// <Name of image>
				// OK
				if (name && !isResolved) {
					isResolved = true;
					resolve(name);
				}

				client.end();
			});
		});
	}

	@cache()
	private get pathToVirtualDeviceManagerExecutable(): string {
		if (this.androidHome) {
			if (this.$fs.exists(this.pathToAvdManagerExecutable)) {
				return this.pathToAvdManagerExecutable;
			}

			if (this.$fs.exists(this.pathToAndroidExecutable)) {
				return this.pathToAndroidExecutable;
			}
		}

		return null;
	}

	@cache()
	private get pathToAvdManagerExecutable(): string {
		if (this.androidHome) {
			const avdManagerPath = path.join(this.androidHome, "tools", "bin", "avdmanager");
			if (this.$hostInfo.isWindows) {
				return `${avdManagerPath}.exe`;
			}

			return avdManagerPath;
		}

		return null;
	}

	@cache()
	private get pathToAndroidExecutable(): string {
		if (this.androidHome) {
			const androidPath = path.join(this.androidHome, "tools", "android");
			if (this.$hostInfo.isWindows) {
				return `${androidPath}.exe`;
			}

			return androidPath;
		}

		return null;
	}

	@cache()
	private get pathToEmulatorExecutable(): string {
		const emulatorExecutableName = "emulator";
		if (this.androidHome) {
			// Check https://developer.android.com/studio/releases/sdk-tools.html (25.3.0)
			// Since this version of SDK tools, the emulator is a separate package.
			// However the emulator executable still exists in the "tools" dir.
			const pathToEmulatorFromAndroidStudio = path.join(this.androidHome, emulatorExecutableName, emulatorExecutableName);
			const realFilePath = this.$hostInfo.isWindows ? `${pathToEmulatorFromAndroidStudio}.exe` : pathToEmulatorFromAndroidStudio;
			if (this.$fs.exists(realFilePath)) {
				return pathToEmulatorFromAndroidStudio;
			}

			return path.join(this.androidHome, "tools", emulatorExecutableName);
		}

		return emulatorExecutableName;
	}

	@cache()
	private get pathToAvdHomeDir(): string {
		const searchPaths = [process.env.ANDROID_AVD_HOME, path.join(osenv.home(), AndroidVirtualDevice.ANDROID_DIR_NAME, AndroidVirtualDevice.AVD_DIR_NAME)];
		return searchPaths.find(p => p && this.$fs.exists(p));
	}

	private listAvdsFromDirectory(): Mobile.IDeviceInfo[] {
		let devices: Mobile.IDeviceInfo[] = [];

		if (this.pathToAvdHomeDir && this.$fs.exists(this.pathToAvdHomeDir)) {
			const entries = this.$fs.readDirectory(this.pathToAvdHomeDir);
			devices = _.filter(entries, (e: string) => e.match(AndroidVirtualDevice.INI_FILES_MASK) !== null)
				.map(e => e.match(AndroidVirtualDevice.INI_FILES_MASK)[1])
				.map(avdName => path.join(this.pathToAvdHomeDir, `${avdName}.ini`))
				.map(avdPath => this.getInfoFromAvd(avdPath))
				.map(avd => this.convertAvdToDeviceInfo(avd));
		}

		return devices;
	}

	private parseListAvdsOutput(output: string): Mobile.IDeviceInfo[] {
		let devices: Mobile.IDeviceInfo[] = [];

		const avialableDevices = output.split(AndroidVirtualDevice.AVAILABLE_AVDS_MESSAGE);
		if (avialableDevices && avialableDevices[1]) {
			devices = avialableDevices[1]
				.split(AndroidVirtualDevice.AVD_LIST_DELIMITER)
				.map(singleDeviceOutput => this.getAvdManagerDeviceInfo(singleDeviceOutput.trim()))
				.map(avdManagerDeviceInfo => this.getInfoFromAvd(avdManagerDeviceInfo.path))
				.map(avdInfo => this.convertAvdToDeviceInfo(avdInfo));
		}

		return devices;
	}

	private getAvdManagerDeviceInfo(output: string): Mobile.IAvdManagerDeviceInfo {
		const avdManagerDeviceInfo: Mobile.IAvdManagerDeviceInfo = Object.create(null);

		_.reduce(output.split(EOL), (result: Mobile.IAvdManagerDeviceInfo, row: string) => {
			const [key, value] = row.split(": ").map(part => part.trim());

			switch (key) {
				case "Name":
				case "Device":
				case "Path":
				case "Target":
				case "Skin":
				case "Sdcard":
					result[key.toLowerCase()] = value;
					break;
			}

			return result;
		}, avdManagerDeviceInfo || {});

		return avdManagerDeviceInfo;
	}

	private getInfoFromAvd(avdFilePath: string): Mobile.IAvdInfo {
		const avdIniFilePath = path.join(path.dirname(avdFilePath), path.basename(avdFilePath).replace(AndroidVirtualDevice.AVD_FILE_EXTENSION, AndroidVirtualDevice.INI_FILE_EXTENSION));
		let avdInfo = this.$androidIniFileParser.parseAvdIniFile(avdIniFilePath);
		if (avdInfo.path && this.$fs.exists(avdInfo.path)) {
			const configIniFilePath = path.join(avdInfo.path, AndroidVirtualDevice.CONFIG_INI_FILE_NAME);
			avdInfo = this.$androidIniFileParser.parseAvdIniFile(configIniFilePath, avdInfo);
		}

		avdInfo.name = path.basename(avdFilePath).replace(AndroidVirtualDevice.INI_FILE_EXTENSION, "");

		return avdInfo;
	}

	private convertAvdToDeviceInfo(avdInfo: Mobile.IAvdInfo): Mobile.IDeviceInfo {
		return {
			identifier: null,
			imageIdentifier: avdInfo.name.replace(AndroidVirtualDevice.AVD_FILE_EXTENSION, ""),
			displayName: avdInfo.device,
			model: avdInfo.device,
			version: avdInfo.target, // TODO: this API LEVEL version should be converted to android version
			vendor: AndroidVirtualDevice.AVD_VENDOR_NAME,
			status: NOT_RUNNING_EMULATOR_STATUS,
			errorHelp: null,
			isTablet: false,
			type: DeviceTypes.Emulator,
			platform: this.$devicePlatformsConstants.Android
		};
	}

	private getImageIdentifierFromClientOutput(output: string): string {
		// The lines should be trimmed after the split because the output has \r\n and when using split(EOL) on mac each line ends with \r.
		const lines = _.map(output.split(EOL), line => line.trim());

		const firstIndexOfOk = _.indexOf(lines, "OK");
		if (firstIndexOfOk < 0) {
			return null;
		}

		const secondIndexOfOk = _.indexOf(lines, "OK", firstIndexOfOk + 1);
		if (secondIndexOfOk < 0) {
			return null;
		}

		return lines[secondIndexOfOk - 1].trim();
	}
}
$injector.register("androidVirtualDeviceService", AndroidVirtualDeviceService);
