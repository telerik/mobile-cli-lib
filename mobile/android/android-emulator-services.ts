import * as iconv from "iconv-lite";
import { EOL } from "os";
import * as osenv from "osenv";
import * as path from "path";
import * as helpers from "../../helpers";
import * as net from "net";
import { DeviceAndroidDebugBridge } from "./device-android-debug-bridge";
import { cache, invokeInit } from "../../decorators";

class AndroidEmulatorServices implements Mobile.IAndroidEmulatorServices {
	private static ANDROID_DIR_NAME = ".android";
	private static AVD_DIR_NAME = "avd";
	private static INI_FILES_MASK = /^(.*)\.ini$/i;
	private static ENCODING_MASK = /^avd\.ini\.encoding=(.*)$/;
	private static TIMEOUT_SECONDS = 120;
	private static UNABLE_TO_START_EMULATOR_MESSAGE = "Cannot run your app in the native emulator. Increase the timeout of the operation with the --timeout option or try to restart your adb server with 'adb kill-server' command. Alternatively, run the Android Virtual Device manager and increase the allocated RAM for the virtual device.";
	private static RUNNING_ANDROID_EMULATOR_REGEX = /^(emulator-\d+)\s+device$/;

	private static MISSING_SDK_MESSAGE = "The Android SDK is not configured properly. " +
	"Verify that you have installed the Android SDK and that you have configured it as described in System Requirements.";
	private static MISSING_GENYMOTION_MESSAGE = "Genymotion is not configured properly. " +
	"Verify that you have installed Genymotion and that you have added its installation directory to your PATH environment variable.";

	private endTimeEpoch: number;
	private adbFilePath: string;
	private _pathToEmulatorExecutable: string;

	constructor(private $logger: ILogger,
		private $emulatorSettingsService: Mobile.IEmulatorSettingsService,
		private $errors: IErrors,
		private $childProcess: IChildProcess,
		private $fs: IFileSystem,
		private $staticConfig: Config.IStaticConfig,
		private $devicePlatformsConstants: Mobile.IDevicePlatformsConstants,
		private $logcatHelper: Mobile.ILogcatHelper,
		private $options: ICommonOptions,
		private $utils: IUtils,
		private $injector: IInjector) {
		iconv.extendNodeEncodings();
	}

	@cache()
	protected async init(): Promise<void> {
		this.adbFilePath = await this.$staticConfig.getAdbFilePath();
	}

	private get pathToEmulatorExecutable(): string {
		if (!this._pathToEmulatorExecutable) {
			let androidHome = process.env.ANDROID_HOME;
			let emulatorExecutableName = "emulator";
			this._pathToEmulatorExecutable = androidHome ? path.join(androidHome, "tools", emulatorExecutableName) : emulatorExecutableName;
		}

		return this._pathToEmulatorExecutable;
	}

	public async getEmulatorId(): Promise<string> {
		let image = this.getEmulatorImage();
		if (!image) {
			this.$errors.fail("Could not find an emulator image to run your project.");
		}

		let emulatorId = await this.startEmulatorInstance(image);
		return emulatorId;
	}

	public async checkDependencies(): Promise<void> {
		await this.checkAndroidSDKConfiguration();
		if (this.$options.geny) {
			await this.checkGenymotionConfiguration();
		}
	}

	public checkAvailability(): void {
		if (!this.getEmulatorImage()) {
			this.$errors.failWithoutHelp("You do not have any Android emulators installed. Please install at least one.");
		}

		let platform = this.$devicePlatformsConstants.Android;
		if (!this.$emulatorSettingsService.canStart(platform)) {
			this.$errors.fail("The current project does not target Android and cannot be run in the Android emulator.");
		}
	}

	public async startEmulator(): Promise<string> {
		if (this.$options.avd && this.$options.geny) {
			this.$errors.fail("You cannot specify both --avd and --geny options. Please use only one of them.");
		}

		let emulatorId: string = null;

		let image = this.getEmulatorImage();
		if (image) {
			// start the emulator, if needed
			emulatorId = await this.startEmulatorInstance(image);

			// waits for the boot animation property of the emulator to switch to 'stopped'
			await this.waitForEmulatorBootToComplete(emulatorId);

			// unlock screen
			await this.unlockScreen(emulatorId);
		} else {
			this.$errors.fail("Could not find an emulator image to run your project.");
		}

		return emulatorId;
	}

	public async runApplicationOnEmulator(app: string, emulatorOptions?: Mobile.IEmulatorOptions): Promise<void> {
		let emulatorId = await this.startEmulator();
		await this.runApplicationOnEmulatorCore(app, emulatorOptions.appId, emulatorId);
	}

	private async checkAndroidSDKConfiguration(): Promise<void> {
		try {
			await this.$childProcess.tryExecuteApplication(this.pathToEmulatorExecutable, ['-help'], "exit", AndroidEmulatorServices.MISSING_SDK_MESSAGE);
		} catch (err) {
			this.$logger.trace(`Error while checking Android SDK configuration: ${err}`);
			this.$errors.failWithoutHelp("Android SDK is not configured properly. Make sure you have added tools and platform-tools to your PATH environment variable.");
		}
	}

	private getDeviceAndroidDebugBridge(deviceIdentifier: string): Mobile.IDeviceAndroidDebugBridge {
		return this.$injector.resolve(DeviceAndroidDebugBridge, { identifier: deviceIdentifier });
	}

	private async checkGenymotionConfiguration(): Promise<void> {
		try {
			let condition = (childProcess: any) => childProcess.stderr && !_.startsWith(childProcess.stderr, "Usage:");
			await this.$childProcess.tryExecuteApplication("player", [], "exit", AndroidEmulatorServices.MISSING_GENYMOTION_MESSAGE, condition);
		} catch (err) {
			this.$logger.trace(`Error while checking Genymotion configuration: ${err}`);
			this.$errors.failWithoutHelp("Genymotion is not configured properly. Make sure you have added its installation directory to your PATH environment variable.");
		}
	}

	private getEmulatorImage(): string {
		let image = this.$options.avd || this.$options.geny || this.getBestFit();
		return image;
	}

	private async runApplicationOnEmulatorCore(app: string, appId: string, emulatorId: string): Promise<void> {
		// install the app
		this.$logger.info("installing %s through adb", app);
		let adb = this.getDeviceAndroidDebugBridge(emulatorId);
		let childProcess = await adb.executeCommand(["install", "-r", app], { returnChildProcess: true });
		await this.$fs.futureFromEvent(childProcess, "close");

		// unlock screen again in cases when the installation is slow
		await this.unlockScreen(emulatorId);

		// run the installed app
		this.$logger.info("running %s through adb", app);

		let androidDebugBridgeCommandOptions: Mobile.IAndroidDebugBridgeCommandOptions = {
			childProcessOptions: { stdio: "ignore", detached: true },
			returnChildProcess: true
		};
		childProcess = await adb.executeShellCommand(["monkey", "-p", appId, "-c", "android.intent.category.LAUNCHER", "1"], androidDebugBridgeCommandOptions);
		await this.$fs.futureFromEvent(childProcess, "close");

		if (!this.$options.justlaunch) {
			await this.$logcatHelper.start(emulatorId);
		}
	}

	private async unlockScreen(emulatorId: string): Promise<void> {
		let adb = this.getDeviceAndroidDebugBridge(emulatorId);
		let childProcess = await adb.executeShellCommand(["input", "keyevent", "82"], { returnChildProcess: true });
		return this.$fs.futureFromEvent(childProcess, "close");
	}

	private sleep(ms: number): Promise<void> {
		return new Promise<void>((resolve, reject) => {
			setTimeout(async () => resolve(), ms);
		});
	}

	private async getRunningEmulatorId(image: string): Promise<string> {
		let runningEmulators = await this.getRunningEmulators();
		if (runningEmulators.length === 0) {
			return "";
		}

		// if we get here, there's at least one running emulator
		let getNameFunction = this.$options.geny ? this.getNameFromGenymotionEmulatorId : this.getNameFromSDKEmulatorId;
		for (let emulatorId of runningEmulators) {
			const currentEmulatorName = await getNameFunction.apply(this, [emulatorId]);
			if (currentEmulatorName === image) {
				return emulatorId;
			}
		}
		this.$errors.failWithoutHelp("Couldn't find emulator id");
	}

	@invokeInit()
	private async getNameFromGenymotionEmulatorId(emulatorId: string): Promise<string> {
		let modelOutputLines: string = await this.$childProcess.execFile(this.adbFilePath, ["-s", emulatorId, "shell", "getprop", "ro.product.model"]);
		this.$logger.trace(modelOutputLines);
		let model = (<string>_.first(modelOutputLines.split(EOL))).trim();
		return model;
	}

	private getNameFromSDKEmulatorId(emulatorId: string): Promise<string> {
		let match = emulatorId.match(/^emulator-(\d+)/);
		let portNumber: string;
		if (match && match[1]) {
			portNumber = match[1];
		} else {
			return Promise.resolve("");
		}

		return new Promise<string>((resolve, reject) => {
			let isResolved = false;
			let output: string = "";
			let client = net.connect(portNumber, () => {
				client.write(`avd name${EOL}`);
			});

			client.on('data', (data: any) => {
				output += data.toString();

				let name = this.getEmulatorNameFromClientOutput(output);
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

	private getEmulatorNameFromClientOutput(output: string): string {
		// The lines should be trimmed after the split because the output has \r\n and when using split(EOL) on mac each line ends with \r.
		let lines: string[] = _.map(output.split(EOL), (line: string) => line.trim());
		let name: string;

		let firstIndexOfOk = _.indexOf(lines, "OK");

		if (firstIndexOfOk < 0) {
			return null;
		}

		let secondIndexOfOk = _.indexOf(lines, "OK", firstIndexOfOk + 1);

		if (secondIndexOfOk < 0) {
			return null;
		}

		name = lines[secondIndexOfOk - 1].trim();

		return name;
	}

	private async startEmulatorInstance(image: string): Promise<string> {
		let emulatorId = await this.getRunningEmulatorId(image);
		this.endTimeEpoch = helpers.getCurrentEpochTime() + this.$utils.getMilliSecondsTimeout(AndroidEmulatorServices.TIMEOUT_SECONDS);
		if (emulatorId) {
			// If there's already a running instance of this image, we'll just deploy the app to it.
			return emulatorId;
		}

		// have to start new emulator
		this.$logger.info("Starting Android emulator with image %s", image);
		if (this.$options.geny) {
			//player is part of Genymotion, it should be part of the PATH.
			this.$childProcess.spawn("player", ["--vm-name", image],
				{ stdio: "ignore", detached: true }).unref();
		} else {
			this.$childProcess.spawn(this.pathToEmulatorExecutable, ['-avd', image],
				{ stdio: "ignore", detached: true }).unref();
		}

		let isInfiniteWait = this.$utils.getMilliSecondsTimeout(AndroidEmulatorServices.TIMEOUT_SECONDS) === 0;
		let hasTimeLeft = helpers.getCurrentEpochTime() < this.endTimeEpoch;

		while (hasTimeLeft || isInfiniteWait) {
			emulatorId = await this.getRunningEmulatorId(image);
			if (emulatorId) {
				return emulatorId;
			}

			await this.sleep(10000); // the emulator definitely takes its time to wake up
			hasTimeLeft = helpers.getCurrentEpochTime() < this.endTimeEpoch;
		}

		if (!hasTimeLeft && !isInfiniteWait) {
			this.$errors.fail(AndroidEmulatorServices.UNABLE_TO_START_EMULATOR_MESSAGE);
		}

		return emulatorId;
	}

	private async getRunningGenymotionEmulators(adbDevicesOutput: string[]): Promise<string[]> {
		let results = await Promise.all<string>(
			<Promise<string>[]>(_(adbDevicesOutput)
				.filter(r => !r.match(AndroidEmulatorServices.RUNNING_ANDROID_EMULATOR_REGEX))
				.map(async row => {
					let match = row.match(/^(.+?)\s+device$/);
					if (match && match[1]) {
						// possible genymotion emulator
						let emulatorId = match[1];
						let result = await this.isGenymotionEmulator(emulatorId) ? emulatorId : undefined;
						return Promise.resolve(result);
					}

					return Promise.resolve(undefined);
				}).value())
		);

		return _(results).filter(r => !!r)
			.map(r => r.toString())
			.value();
	}

	private async getRunningAvdEmulators(adbDevicesOutput: string[]): Promise<string[]> {
		let emulatorDevices: string[] = [];
		_.each(adbDevicesOutput, (device: string) => {
			let rx = device.match(AndroidEmulatorServices.RUNNING_ANDROID_EMULATOR_REGEX);

			if (rx && rx[1]) {
				emulatorDevices.push(rx[1]);
			}
		});
		return emulatorDevices;
	}

	@invokeInit()
	private async isGenymotionEmulator(emulatorId: string): Promise<boolean> {
		let manufacturer = await this.$childProcess.execFile(this.adbFilePath, ["-s", emulatorId, "shell", "getprop", "ro.product.manufacturer"]);
		if (manufacturer.match(/^Genymotion/i)) {
			return true;
		}

		let buildProduct = await this.$childProcess.execFile(this.adbFilePath, ["-s", emulatorId, "shell", "getprop", "ro.build.product"]);
		if (buildProduct && _.includes(buildProduct.toLowerCase(), "vbox")) {
			return true;
		}

		return false;
	}

	@invokeInit()
	public async getAllRunningEmulators(): Promise<string[]> {
		let outputRaw: string[] = (await this.$childProcess.execFile(this.adbFilePath, ['devices'])).split(EOL);
		let emulators = (await this.getRunningAvdEmulators(outputRaw)).concat(await this.getRunningGenymotionEmulators(outputRaw));
		return emulators;
	}

	@invokeInit()
	private async getRunningEmulators(): Promise<string[]> {
		let outputRaw: string[] = (await this.$childProcess.execFile(this.adbFilePath, ['devices'])).split(EOL);
		if (this.$options.geny) {
			return await this.getRunningGenymotionEmulators(outputRaw);
		} else {
			return await this.getRunningAvdEmulators(outputRaw);
		}
	}

	private getBestFit(): string {
		let minVersion = this.$emulatorSettingsService.minVersion;

		let best = _(this.getAvds())
			.map(avd => this.getInfoFromAvd(avd))
			.maxBy(avd => avd.targetNum);

		return (best && best.targetNum >= minVersion) ? best.name : null;
	}

	private getInfoFromAvd(avdName: string): Mobile.IAvdInfo {
		let iniFile = path.join(this.avdDir, avdName + ".ini");
		let avdInfo: Mobile.IAvdInfo = this.parseAvdFile(avdName, iniFile);
		if (avdInfo.path && this.$fs.exists(avdInfo.path)) {
			iniFile = path.join(avdInfo.path, "config.ini");
			avdInfo = this.parseAvdFile(avdName, iniFile, avdInfo);
		}
		return avdInfo;
	}

	private parseAvdFile(avdName: string, avdFileName: string, avdInfo?: Mobile.IAvdInfo): Mobile.IAvdInfo {
		if (!this.$fs.exists(avdFileName)) {
			return null;
		}

		// avd files can have different encoding, defined on the first line.
		// find which one it is (if any) and use it to correctly read the file contents
		let encoding = this.getAvdEncoding(avdFileName);
		let contents = this.$fs.readText(avdFileName, encoding).split("\n");

		avdInfo = _.reduce(contents, (result: Mobile.IAvdInfo, line: string) => {
			let parsedLine = line.split("=");
			let key = parsedLine[0];
			switch (key) {
				case "target":
					result.target = parsedLine[1];
					result.targetNum = this.readTargetNum(result.target);
					break;
				case "path": result.path = parsedLine[1]; break;
				case "hw.device.name": result.device = parsedLine[1]; break;
				case "abi.type": result.abi = parsedLine[1]; break;
				case "skin.name": result.skin = parsedLine[1]; break;
				case "sdcard.size": result.sdcard = parsedLine[1]; break;
			}
			return result;
		},
			avdInfo || <Mobile.IAvdInfo>Object.create(null));
		avdInfo.name = avdName;
		return avdInfo;
	}

	// Android L is not written as a number in the .ini files, and we need to convert it
	private readTargetNum(target: string): number {
		let platform = target.replace('android-', '');
		let platformNumber = +platform;
		if (isNaN(platformNumber)) {
			// this may be a google image
			let googlePlatform = target.split(":")[2];
			if (googlePlatform) {
				platformNumber = +googlePlatform;
			} else if (platform === "L") { // Android SDK 20 preview
				platformNumber = 20;
			} else if (platform === "MNC") { // Android M preview
				platformNumber = 22;
			}
		}
		return platformNumber;
	}

	private getAvdEncoding(avdName: string): any {
		// avd files can have different encoding, defined on the first line.
		// find which one it is (if any) and use it to correctly read the file contents
		let encoding = "utf8";
		let contents = this.$fs.readText(avdName, "ascii");
		if (contents.length > 0) {
			contents = contents.split("\n", 1)[0];
			if (contents.length > 0) {
				let matches = contents.match(AndroidEmulatorServices.ENCODING_MASK);
				if (matches) {
					encoding = matches[1];
				}
			}
		}
		return encoding;
	}

	private get androidHomeDir(): string {
		return path.join(osenv.home(), AndroidEmulatorServices.ANDROID_DIR_NAME);
	}

	private get avdDir(): string {
		return path.join(this.androidHomeDir, AndroidEmulatorServices.AVD_DIR_NAME);
	}

	private getAvds(): string[] {
		let result: string[] = [];
		if (this.$fs.exists(this.avdDir)) {
			let entries = this.$fs.readDirectory(this.avdDir);
			result = _.filter(entries, (e: string) => e.match(AndroidEmulatorServices.INI_FILES_MASK) !== null)
				.map((e) => e.match(AndroidEmulatorServices.INI_FILES_MASK)[1]);
		}
		return result;
	}

	private async waitForEmulatorBootToComplete(emulatorId: string): Promise<void> {
		this.$logger.printInfoMessageOnSameLine("Waiting for emulator device initialization...");

		let isInfiniteWait = this.$utils.getMilliSecondsTimeout(AndroidEmulatorServices.TIMEOUT_SECONDS) === 0;
		while (helpers.getCurrentEpochTime() < this.endTimeEpoch || isInfiniteWait) {
			let isEmulatorBootCompleted = await this.isEmulatorBootCompleted(emulatorId);

			if (isEmulatorBootCompleted) {
				this.$logger.printInfoMessageOnSameLine(EOL);
				return;
			}

			this.$logger.printInfoMessageOnSameLine(".");
			await this.sleep(10000);
		}

		this.$logger.printInfoMessageOnSameLine(EOL);
		this.$errors.fail(AndroidEmulatorServices.UNABLE_TO_START_EMULATOR_MESSAGE);
	}

	@invokeInit()
	private async isEmulatorBootCompleted(emulatorId: string): Promise<boolean> {
		let output = await this.$childProcess.execFile(this.adbFilePath, ["-s", emulatorId, "shell", "getprop", "dev.bootcomplete"]);
		let matches = output.match("1");
		return matches && matches.length > 0;
	}
}
$injector.register("androidEmulatorServices", AndroidEmulatorServices);
