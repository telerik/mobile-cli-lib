///<reference path="../../../.d.ts"/>
"use strict";

import Fiber = require("fibers");
import Future = require("fibers/future");
import iconv = require("iconv-lite");
import os = require("os");
import osenv = require("osenv");
import path = require("path");
import util = require("util");
import MobileHelper = require("../mobile-helper");
import options = require("../../options");
import helpers = require("../../helpers");
var net = require('net');

class VirtualMachine {
	constructor(public name: string, public identifier: string) { }
}

class AndroidEmulatorServices implements Mobile.IEmulatorPlatformServices {
	private static ANDROID_DIR_NAME = ".android";
	private static AVD_DIR_NAME = "avd";
	private static INI_FILES_MASK = /^(.*)\.ini$/i;
	private static ENCODING_MASK = /^avd\.ini\.encoding=(.*)$/;
	private static TIMEOUT_SECONDS = 120;
	private static UNABLE_TO_START_EMULATOR_MESSAGE = "Cannot run your app in the native emulator. Increase the timeout of the operation with the --timeout option or try to restart your adb server with 'adb kill-server' command. Alternatively, run the Android Virtual Device manager and increase the allocated RAM for the virtual device.";
	private static RUNNING_ANDROID_EMULATOR_REGEX = /^(emulator-\d+)\s+device$/;

	private static MISSING_SDK_MESSAGE = "The Android SDK is not configured properly. " +
		"Verify that you have installed the Android SDK and that you have added its `platform-tools` and `tools` directories to your PATH environment variable.";
	private static MISSING_GENYMOTION_MESSAGE = "Genymotion is not configured properly. " +
		"Verify that you have installed Genymotion and that you have added its installation directory to your PATH environment variable.";

	private endTimeEpoch: number;
	private adbFilePath: string;

	constructor(private $logger: ILogger,
		private $emulatorSettingsService: Mobile.IEmulatorSettingsService,
		private $errors: IErrors,
		private $childProcess: IChildProcess,
		private $fs: IFileSystem,
		private $staticConfig: Config.IStaticConfig) {
		iconv.extendNodeEncodings();
		this.adbFilePath = helpers.getPathToAdb($injector).wait();
	}

	public checkDependencies(): IFuture<void> {
		return (() => {
			this.checkAndroidSDKConfiguration().wait();
			if(options.geny) {
				this.checkGenymotionConfiguration().wait();
			}
		}).future<void>()();
	}

	private checkAndroidSDKConfiguration(): IFuture<void> {
		return (() => {
			try {
				var proc = this.$childProcess.spawnFromEvent('emulator', ['-help'], "exit", undefined, { throwError: false }).wait();

				if(proc.stderr) {
					this.$errors.fail({formatStr: AndroidEmulatorServices.MISSING_SDK_MESSAGE, suppressCommandHelp: true});
				}
			} catch (e) {
				var message: string = (e.code === "ENOENT") ? AndroidEmulatorServices.MISSING_SDK_MESSAGE : e.message;
				this.$errors.failWithoutHelp(message);
			}
		}).future<void>()();
	}

	private checkGenymotionConfiguration(): IFuture<void> {
		return (() => {
			try {
				var proc = this.$childProcess.spawnFromEvent("player", [], "exit", undefined, { throwError: false }).wait();
			} catch(e) {
				var message: string = (e.code === "ENOENT") ? AndroidEmulatorServices.MISSING_SDK_MESSAGE : e.message;
				this.$errors.failWithoutHelp(message);
			}

			if(proc.stderr && !proc.stderr.startsWith("Usage:")) {
				this.$errors.failWithoutHelp(AndroidEmulatorServices.MISSING_GENYMOTION_MESSAGE);
			}
		}).future<void>()();
	}

	public checkAvailability(): IFuture<void> {
		return (() => {
			var platform = MobileHelper.DevicePlatforms[MobileHelper.DevicePlatforms.Android];
			if(!this.$emulatorSettingsService.canStart(platform).wait()) {
				this.$errors.fail("The current project does not target Android and cannot be run in the Android emulator.");
			}
		}).future<void>()();
	}

	public startEmulator(app: string, emulatorOptions?: Mobile.IEmulatorOptions): IFuture<void> {
		return (() => {
			if(options.avd && options.geny) {
				this.$errors.fail("You cannot specify both --avd and --geny options. Please use only one of them.");
			}

			var image = options.avd || options.geny || this.getBestFit().wait();

			if(image) {
				this.startEmulatorCore(app, emulatorOptions.appId, image).wait();
			} else {
				this.$errors.fail("Could not find an emulator image to run your project.");
			}
		}).future<void>()();
	}

	private startEmulatorCore(app: string, appId: string, image: string): IFuture<void> {
		return (() => {
			// start the emulator, if needed
			var emulatorId = this.startEmulatorInstance(image).wait();

			// waits for the boot animation property of the emulator to switch to 'stopped'
			this.waitForEmulatorBootToComplete(emulatorId).wait();

			// unlock screen
			this.unlockScreen(emulatorId).wait();

			// install the app
			this.$logger.info("installing %s through adb", app);
			var childProcess = this.$childProcess.spawn(this.adbFilePath, ["-s", emulatorId, 'install', '-r', app]);
			this.$fs.futureFromEvent(childProcess, "close").wait();

			// unlock screen again in cases when the installation is slow
			this.unlockScreen(emulatorId).wait();

			// run the installed app
			this.$logger.info("running %s through adb", app);
			childProcess = this.$childProcess.spawn(this.adbFilePath, ["-s", emulatorId, 'shell', 'am', 'start', '-S', appId + "/" + this.$staticConfig.START_PACKAGE_ACTIVITY_NAME],
				{ stdio: "ignore", detached: true });
			this.$fs.futureFromEvent(childProcess, "close").wait();
		}).future<void>()();
	}

	private unlockScreen(emulatorId: string): IFuture<void> {
		var childProcess = this.$childProcess.spawn(this.adbFilePath, ["-s", emulatorId, "shell", "input", "keyevent", "82"]);
		return this.$fs.futureFromEvent(childProcess, "close");
	}

	private sleep(ms: number): void {
		var fiber = Fiber.current;
		setTimeout(() => fiber.run(), ms);
		Fiber.yield();
	}

	private getMilliSecondsTimeout(): number {
		var timeout = AndroidEmulatorServices.TIMEOUT_SECONDS;

		if(options && options.timeout) {
			var parsedValue = parseInt(options.timeout);
			if(!isNaN(parsedValue) && parsedValue >= 0) {
				timeout = parsedValue;
			} else {
				this.$logger.info("Specify timeout in a number of seconds to wait. Set it to 0 to wait indefinitely. Default value: " + timeout + " seconds will be used.");
			}
		}

		return timeout * 1000;
	}


	private getRunningEmulatorId(image: string): IFuture<string> {
		return ((): string => {
			var runningEmulators = this.getRunningEmulators().wait();
			if(runningEmulators.length === 0) {
				return "";
			}

			// if we get here, there's at least one running emulator
			var getNameFunction = options.geny ? this.getNameFromGenymotionEmulatorId : this.getNameFromSDKEmulatorId;
			var emulatorId = _(runningEmulators).find(emulator => getNameFunction.apply(this, [emulator]).wait() === image);

			return emulatorId;
		}).future<string>()();
	}

	private getNameFromGenymotionEmulatorId(emulatorId: string): IFuture<string> {
		return (() => {
			var modelOutputLines: string = this.$childProcess.execFile(this.adbFilePath, ["-s", emulatorId, "shell", "getprop", "ro.product.model"]).wait();
			this.$logger.trace(modelOutputLines);
			var model = (<string>_.first(modelOutputLines.split(os.EOL))).trim();
			return model;
		}).future<string>()();
	}

	private getNameFromSDKEmulatorId(emulatorId: string): IFuture<string> {
		var match = emulatorId.match(/^emulator-(\d+)/);
		var portNumber: string;
		if(match && match[1]) {
			portNumber = match[1];
		} else {
			return Future.fromResult("");
		}

		var future = new Future<string>();
		var output: string = "";
		var client = net.connect({ port: portNumber }, () => { 
			client.write(util.format("avd name%s", os.EOL));
		});

		client.on('data', (data: any) => {
			output += data.toString();
			client.end();
		});
		client.on('end', () => {
			//output should look like:
			//Android Console: type 'help' for a list of commands
			//OK
			//<Name of image>
			//OK
			//
			var name: string;
			var foundOK = false;
			var lines: string[] = output.split(os.EOL);
			// find line between OK
			_(lines).each((line: string) => {
				if(foundOK) {
					name = line.trim();
					return false;
				} else if(line.match(/^OK/)) {
					foundOK = true;
				}
			});

			future.return(name);
		});
		return future;
	}

	private startEmulatorInstance(image: string): IFuture<string> {
		return (() => {
			var emulatorId = this.getRunningEmulatorId(image).wait();
			this.endTimeEpoch = helpers.getCurrentEpochTime() + this.getMilliSecondsTimeout();
			if(emulatorId) {
				// If there's already a running instance of this image, we'll just deploy the app to it.
				return emulatorId;
			}

			// have to start new emulator
			this.$logger.info("Starting Android emulator with image %s", image);
			if(options.geny) {
				//player is part of Genymotion, it should be part of the PATH.
				this.$childProcess.spawn("player", ["--vm-name", image],
					{ stdio: "ignore", detached: true }).unref();
			} else {
				this.$childProcess.spawn('emulator', ['-avd', image],
					{ stdio: "ignore", detached: true }).unref();
			}
			
			var isInfiniteWait = this.getMilliSecondsTimeout() === 0;
			var hasTimeLeft = helpers.getCurrentEpochTime() < this.endTimeEpoch;

			while(hasTimeLeft || isInfiniteWait) {
				emulatorId = this.getRunningEmulatorId(image).wait();
				if(emulatorId) {
					return emulatorId;
				}

				this.sleep(10000); // the emulator definitely takes its time to wake up
				hasTimeLeft = helpers.getCurrentEpochTime() < this.endTimeEpoch;
			}

			if(!hasTimeLeft && !isInfiniteWait) {
				this.$errors.fail(AndroidEmulatorServices.UNABLE_TO_START_EMULATOR_MESSAGE);
			}

			return emulatorId;
		}).future<string>()();
	}

	private getRunningGenymotionEmulators(adbDevicesOutput: string[]): IFuture<string[]> {
		return ((): string[]=> {
			var futures = _(adbDevicesOutput).filter(r => !r.match(AndroidEmulatorServices.RUNNING_ANDROID_EMULATOR_REGEX))
				.map(row => {
					var match = row.match(/^(.+?)\s+device$/);
					if(match && match[1]) {
						// possible genymotion emulator 
						var emulatorId = match[1];
						return this.checkForGenymotionProductManufacturer(emulatorId);
					}

					return Future.fromResult(undefined);
				}).value();

			Future.wait(futures);

			return _(futures).filter(future => !!future.get())
				.map(f => f.get().toString())
				.value();
		}).future<string[]>()();
	}

	private checkForGenymotionProductManufacturer(emulatorId: string): IFuture<string> {
		return ((): string => {
			var manufacturer = this.$childProcess.execFile(this.adbFilePath, ["-s", emulatorId, "shell", "getprop", "ro.product.manufacturer"]).wait();
			if(manufacturer.match(/^Genymotion/i)) {
				return emulatorId;
			}

			return undefined;
		}).future<string>()();
	}

	private getRunningEmulators(): IFuture<string[]> {
		return (() => {
			var emulatorDevices: string[] = [];
			var outputRaw: string[] = this.$childProcess.execFile(this.adbFilePath, ['devices']).wait().split(os.EOL);
			if(options.geny) {
				emulatorDevices = this.getRunningGenymotionEmulators(outputRaw).wait();
			} else {
				_.each(outputRaw, (device: string) => {
					var rx = device.match(AndroidEmulatorServices.RUNNING_ANDROID_EMULATOR_REGEX);

					if(rx && rx[1]) {
						emulatorDevices.push(rx[1]);
					}
				});
			}
			return emulatorDevices;
		}).future<string[]>()();
	}

	private getBestFit(): IFuture<string> {
		return (() => {
			var minVersion = this.$emulatorSettingsService.minVersion;

			var best =_(this.getAvds().wait())
				.map(avd => this.getInfoFromAvd(avd).wait())
				.max(avd => avd.targetNum)
				.value();

			return (best.targetNum >= minVersion) ? best.name : null;
		}).future<string>()();
	}

	private getInfoFromAvd(avdName: string): IFuture<Mobile.IAvdInfo> {
		return (() => {
			var iniFile = path.join(this.avdDir, avdName + ".ini");
			var avdInfo: Mobile.IAvdInfo = this.parseAvdFile(avdName, iniFile).wait();
			if (avdInfo.path && this.$fs.exists(avdInfo.path).wait()) {
				iniFile = path.join(avdInfo.path, "config.ini");
				avdInfo = this.parseAvdFile(avdName, iniFile, avdInfo).wait();
			}
			return avdInfo;
		}).future<Mobile.IAvdInfo>()();
	}

	private parseAvdFile(avdName: string, avdFileName: string, avdInfo: Mobile.IAvdInfo = null): IFuture<Mobile.IAvdInfo> {
		return (() => {
			// avd files can have different encoding, defined on the first line.
			// find which one it is (if any) and use it to correctly read the file contents
			var encoding = this.getAvdEncoding(avdFileName).wait();
			var contents = this.$fs.readText(avdFileName, encoding).wait().split("\n");

			avdInfo = _.reduce(contents, (result: Mobile.IAvdInfo, line:string) => {
					var parsedLine = line.split("=");
					var key = parsedLine[0];
					switch(key) {
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
					avdInfo  || <Mobile.IAvdInfo>Object.create(null));
			avdInfo.name = avdName;
			return avdInfo;
		}).future<Mobile.IAvdInfo>()();
	}

	// Android L is not written as a number in the .ini files, and we need to convert it
	private readTargetNum(target: string): number {
		var platform = target.replace('android-', '');
		var platformNumber = +platform;
		if (isNaN(platformNumber)) {
			if (platform === "L") {
				platformNumber = 20;
			}
		}
		return platformNumber;
	}

	private getAvdEncoding(avdName: string): IFuture<any> {
		return (() => {
			// avd files can have different encoding, defined on the first line.
			// find which one it is (if any) and use it to correctly read the file contents
			var encoding = "utf8";
			var contents = this.$fs.readText(avdName, "ascii").wait();
			if (contents.length > 0) {
				contents = contents.split("\n", 1)[0];
				if (contents.length > 0) {
					var matches = contents.match(AndroidEmulatorServices.ENCODING_MASK);
					if(matches) {
						encoding = matches[1];
					}
				}
			}
			return encoding;
		}).future<any>()();
	}

	private get androidHomeDir(): string {
		return path.join(osenv.home(), AndroidEmulatorServices.ANDROID_DIR_NAME);
	}

	private get avdDir(): string {
		return path.join(this.androidHomeDir, AndroidEmulatorServices.AVD_DIR_NAME);
	}

	private getAvds(): IFuture<string[]> {
		return (() => {
			var result:string[] = [];
			if (this.$fs.exists(this.avdDir).wait()) {
				var entries = this.$fs.readDirectory(this.avdDir).wait();
				result = _.select(entries, (e: string) => e.match(AndroidEmulatorServices.INI_FILES_MASK) !== null)
					.map((e) => e.match(AndroidEmulatorServices.INI_FILES_MASK)[1]);
			}
			return result;
		}).future<string[]>()();
	}

	private waitForEmulatorBootToComplete(emulatorId: string): IFuture<void> {
		return (() => {
			helpers.printInfoMessageOnSameLine("Waiting for emulator device initialization...");

			var isInfiniteWait = this.getMilliSecondsTimeout() === 0;
			while(helpers.getCurrentEpochTime() < this.endTimeEpoch || isInfiniteWait) {
				var isEmulatorBootCompleted = this.isEmulatorBootCompleted(emulatorId).wait();

				if(isEmulatorBootCompleted) {
					helpers.printInfoMessageOnSameLine(os.EOL);
					return;
				}

				helpers.printInfoMessageOnSameLine(".");
				this.sleep(10000);
			}

			helpers.printInfoMessageOnSameLine(os.EOL);
			this.$errors.fail(AndroidEmulatorServices.UNABLE_TO_START_EMULATOR_MESSAGE);
		}).future<void>()();
	}

	private isEmulatorBootCompleted(emulatorId: string): IFuture<boolean> {
		return (() => {
			var output = this.$childProcess.execFile(this.adbFilePath, ["-s", emulatorId, "shell", "getprop", "dev.bootcomplete"]).wait();
			var matches = output.match("1");
			return matches && matches.length > 0;
		}).future<boolean>()();
	}
}
$injector.register("androidEmulatorServices", AndroidEmulatorServices);
