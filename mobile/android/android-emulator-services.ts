///<reference path="../../../.d.ts"/>
"use strict";

import Fiber = require("fibers");
import Future = require("fibers/future");
import iconv = require("iconv-lite");
import os = require("os");
import osenv = require("osenv");
import path = require("path");
import util = require("util");
import hostInfo = require("../../../common/host-info");
import MobileHelper = require("./../mobile-helper");
import options = require("../../options");
import helpers = require("../../helpers");

class AndroidEmulatorServices implements Mobile.IEmulatorPlatformServices {
	private static ANDROID_DIR_NAME = ".android";
	private static AVD_DIR_NAME = "avd";
	private static INI_FILES_MASK = /^(.*)\.ini$/i;
	private static ENCODING_MASK = /^avd\.ini\.encoding=(.*)$/;
	private static TIMEOUT_SECONDS = 120;
	private static UNABLE_TO_START_EMULATOR_MESSAGE = "Cannot run your app in the native emulator. Increase the timeout of the operation with the --timeout option or try to restart your adb server with 'adb kill-server' command. Alternatively, run the Android Virtual Device manager and increase the allocated RAM for the virtual device.";

	private endTimeEpoch: number;

	constructor(private $logger: ILogger,
		private $emulatorSettingsService: Mobile.IEmulatorSettingsService,
		private $errors: IErrors,
		private $childProcess: IChildProcess,
		private $fs: IFileSystem,
		private $staticConfig: IStaticConfig) {
		iconv.extendNodeEncodings();
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
			var image = options.avd || this.getBestFit().wait();

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
			var childProcess = this.$childProcess.spawn(this.$staticConfig.adbFilePath, ["-s", emulatorId, "shell", "input", "keyevent", "82"]);
			this.$fs.futureFromEvent(childProcess, "close").wait();

			// install the app
			this.$logger.info("installing %s through adb", app);
			childProcess = this.$childProcess.spawn(this.$staticConfig.adbFilePath, ["-s", emulatorId, 'install', '-r', app]);
			this.$fs.futureFromEvent(childProcess, "close").wait();

			// run the installed app
			this.$logger.info("running %s through adb", app);
			childProcess = this.$childProcess.spawn(this.$staticConfig.adbFilePath, ["-s", emulatorId, 'shell', 'am', 'start', '-S', appId + "/" + this.$staticConfig.START_PACKAGE_ACTIVITY_NAME],
				{ stdio: ["ignore", "ignore", "ignore"], detached: true });
			this.$fs.futureFromEvent(childProcess, "close").wait();
		}).future<void>()();
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

	private startEmulatorInstance(image: string): IFuture<string> {
		return (() => {
			var initiallyRunningEmulators = this.getRunningEmulators().wait();

			// If there's no running emulators or the user had specified an image (--avd) we have to start new emulator.
			if(initiallyRunningEmulators.length === 0 || options.avd) {
				this.$logger.info("Starting Android emulator with image %s", image);
				this.$childProcess.spawn('emulator', ['-avd', image],
					{ stdio: "ignore", detached: true }).unref();
			}

			var runningEmulators = this.getRunningEmulators().wait();
			var isInfiniteWait = this.getMilliSecondsTimeout() === 0;
			this.endTimeEpoch = helpers.getCurrentEpochTime() + this.getMilliSecondsTimeout();
			var hasTimeLeft = helpers.getCurrentEpochTime() < this.endTimeEpoch;

			while(hasTimeLeft || isInfiniteWait) {
				if(runningEmulators.length > initiallyRunningEmulators.length || (runningEmulators.length > 0 && !options.avd)) {
					break;
				}

				this.sleep(10000); // the emulator definitely takes its time to wake up
				runningEmulators = this.getRunningEmulators().wait();
				hasTimeLeft = helpers.getCurrentEpochTime() < this.endTimeEpoch;
			}

			if(!hasTimeLeft && !isInfiniteWait) {
				this.$errors.fail(AndroidEmulatorServices.UNABLE_TO_START_EMULATOR_MESSAGE);
			}

			var emulatorId = _.first(runningEmulators);
			if(options.avd) {
				// get the id of the started emulator
				_.forEach(runningEmulators, (emulator) => {
					if(!_.contains(initiallyRunningEmulators, emulator)) {
						emulatorId = emulator;
					}
				});
			}

			return emulatorId;
		}).future<string>()();
	}

	private getRunningEmulators(): IFuture<string[]> {
		return (() => {
			var emulatorDevices: string[] = [];
			var outputRaw = this.$childProcess.execFile(this.$staticConfig.adbFilePath, ['devices']).wait().split(os.EOL);
			_.each(outputRaw, (device: string) => {
				var rx = device.match(/^(emulator-\d+)\s+device$/);
				if (rx && rx[1]) {
					emulatorDevices.push(rx[1]);
				}
			});
			return emulatorDevices;
		}).future<string[]>()();
	}

	private getBestFit(): IFuture<string> {
		return (() => {
			var minVersion = this.$emulatorSettingsService.minVersion;

			var best =_.chain(this.getAvds().wait())
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
			var output = this.$childProcess.execFile(this.$staticConfig.adbFilePath, ["-s", emulatorId, "shell", "getprop", "dev.bootcomplete"]).wait();
			var matches = output.match("1");
			return matches && matches.length > 0;
		}).future<boolean>()();
	}
}
$injector.register("androidEmulatorServices", AndroidEmulatorServices);
