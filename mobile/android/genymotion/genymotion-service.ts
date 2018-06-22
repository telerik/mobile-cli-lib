import { AndroidVirtualDevice, DeviceTypes, NOT_RUNNING_EMULATOR_STATUS } from "../../../constants";
import { EOL } from "os";

export class AndroidGenymotionService implements Mobile.IAndroidVirtualDeviceService {
	constructor(private $adb: Mobile.IAndroidDebugBridge,
		private $childProcess: IChildProcess,
		private $devicePlatformsConstants: Mobile.IDevicePlatformsConstants,
		private $emulatorHelper: Mobile.IEmulatorHelper,
		private $fs: IFileSystem,
		private $hostInfo: IHostInfo,
		private $logger: ILogger,
		private $virtualBoxService: Mobile.IVirtualBoxService) { }

	public async getAvailableEmulators(adbDevicesOutput: string[]): Promise<Mobile.IAvailableEmulatorsOutput> {
		const availableEmulatorsOutput = await this.getAvailableEmulatorsCore();
		const genies = availableEmulatorsOutput.devices;
		const runningEmulatorIds = await this.getRunningEmulatorIds(adbDevicesOutput);
		const runningEmulators = await Promise.all(runningEmulatorIds.map(emulatorId => this.getRunningEmulatorData(emulatorId, genies)));
		const devices = availableEmulatorsOutput.devices.map(emulator => this.$emulatorHelper.getEmulatorByImageIdentifier(emulator.imageIdentifier, runningEmulators) || emulator);
		return {
			devices,
			errors: availableEmulatorsOutput.errors
		};
	}

	public async getRunningEmulatorIds(adbDevicesOutput: string[]): Promise<string[]> {
		const results = await Promise.all<string>(
			<Promise<string>[]>(_(adbDevicesOutput)
				.filter(r => !r.match(AndroidVirtualDevice.RUNNING_AVD_EMULATOR_REGEX))
				.map(async row => {
					const match = row.match(/^(.+?)\s+device$/);
					if (match && match[1]) {
						// possible genymotion emulator
						const emulatorId = match[1];
						const result = await this.isGenymotionEmulator(emulatorId) ? emulatorId : undefined;
						return Promise.resolve(result);
					}

					return Promise.resolve(undefined);
				}).value())
		);

		return _(results).filter(r => !!r)
			.map(r => r.toString())
			.value();
	}

	public startEmulator(imageIdentifier: string): void {
		const pathToPlayer = this.$fs.exists(this.defaultPlayerPath) ? this.defaultPlayerPath : "player";
		try {
			return this.$childProcess.spawn(pathToPlayer, ["--vm-name", imageIdentifier], { stdio: "ignore", detached: true }).unref();
		} catch (err) {
			this.$logger.trace(`error while starting emulator. More info: ${err}`);
		}
	}

	private async getAvailableEmulatorsCore(): Promise<Mobile.IAvailableEmulatorsOutput> {
		const output = await this.$virtualBoxService.listVms();
		if (output.error) {
			return { devices: [], errors: output.error ? [output.error] : [] };
		}

		const devices = await this.parseListVmsOutput(output.vms);
		return { devices, errors: [] };
	}

	private async getRunningEmulatorData(runningEmulatorId: string, availableEmulators: Mobile.IDeviceInfo[]): Promise<Mobile.IDeviceInfo> {
		const emulatorName = await this.getNameFromRunningEmulatorId(runningEmulatorId);
		const runningEmulator = this.$emulatorHelper.getEmulatorByIdOrName(emulatorName, availableEmulators);
		if (!runningEmulator) {
			return null;
		}

		this.$emulatorHelper.setRunningAndroidEmulatorProperties(runningEmulatorId, runningEmulator);

		return runningEmulator;
	}

	private async getNameFromRunningEmulatorId(emulatorId: string): Promise<string> {
		const output = await this.$adb.getPropertyValue(emulatorId, "ro.product.model");
		this.$logger.trace(output);
		return (<string>_.first(output.split(EOL))).trim();
	}

	private get defaultPlayerPath() {
		if (this.$hostInfo.isDarwin) {
			return "/Applications/Genymotion.app/Contents/MacOS/player.app/Contents/MacOS/player";
		}

		if (this.$hostInfo.isWindows) {
			return "";
		}

		if (this.$hostInfo.isLinux) {
			return "";
		}
	}

	private async parseListVmsOutput(vms: Mobile.IVirtualBoxVm[]): Promise<Mobile.IDeviceInfo[]> {
		const devices: Mobile.IDeviceInfo[] = [];

		for (const vm of vms) {
			const output = await this.$virtualBoxService.enumerateGuestProperties(vm.id);
			if (output && output.properties && output.properties.indexOf("genymotion") !== -1) {
				devices.push(this.convertToDeviceInfo(output.properties, vm.id, vm.name, output.error));
			}
		}

		return devices;
	}

	private convertToDeviceInfo(output: string, id: string, name: string, error: string): Mobile.IDeviceInfo {
		return {
			identifier: null,
			imageIdentifier: id,
			displayName: name,
			model: name,
			version: this.getSdkVersion(output),
			vendor: AndroidVirtualDevice.GENYMOTION_VENDOR_NAME,
			status: NOT_RUNNING_EMULATOR_STATUS,
			errorHelp: error || null,
			isTablet: false, //TODO: Consider how to populate this correctly when the device is not running
			type: DeviceTypes.Emulator,
			platform: this.$devicePlatformsConstants.Android
		};
	}

	private getSdkVersion(output: string): string {
		// Example -> Name: android_version, value: 6.0.0, timestamp: 1530090506102029000, flags:
		const androidApiLevelRow = output
			.split("\n")
			.filter(row => !!row)
			.find(row => row.indexOf("Name: android_version") !== -1);

		return androidApiLevelRow.split(", ")[1].split("value: ")[1];
	}

	private async isGenymotionEmulator(emulatorId: string): Promise<boolean> {
		const manufacturer = await this.$adb.getPropertyValue(emulatorId, "ro.product.manufacturer");
		if (manufacturer && manufacturer.match(/^Genymotion/i)) {
			return true;
		}

		const buildProduct = await this.$adb.getPropertyValue(emulatorId, "ro.build.product");
		if (buildProduct && _.includes(buildProduct.toLowerCase(), "vbox")) {
			return true;
		}

		return false;
	}
}
$injector.register("androidGenymotionService", AndroidGenymotionService);
