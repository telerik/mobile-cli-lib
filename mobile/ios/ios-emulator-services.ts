///<reference path="../../../.d.ts"/>
"use strict";

import util = require("util");
import Future = require("fibers/future");
import hostInfo = require("../../host-info");
import MobileHelper = require("./../mobile-helper");
import options = require("./../../options");

class IosEmulatorServices implements Mobile.IEmulatorPlatformServices {
	constructor(private $logger: ILogger,
		private $emulatorSettingsService: Mobile.IEmulatorSettingsService,
		private $errors: IErrors,
		private $childProcess: IChildProcess) { }

	public checkDependencies(): IFuture<void> {
		return (() => {
		}).future<void>()();
	}

	checkAvailability(dependsOnProject: boolean = true): IFuture<void> {
		return (() => {
			if(!hostInfo.isDarwin()) {
				this.$errors.fail("iOS Simulator is available only on Mac OS X.");
			}

			var platform = MobileHelper.DevicePlatforms[MobileHelper.DevicePlatforms.iOS];
			if(dependsOnProject && !this.$emulatorSettingsService.canStart(platform).wait()) {
				this.$errors.fail("The current project does not target iOS and cannot be run in the iOS Simulator.");
			}
		}).future<void>()();
	}

	startEmulator(app: string, emulatorOptions?: Mobile.IEmulatorOptions): IFuture<void> {
		return (() => {
			this.killLaunchdSim().wait();
			this.startEmulatorCore(app, emulatorOptions);

		}).future<void>()();
	}

	private killLaunchdSim(): IFuture<void> {
		this.$logger.info("Cleaning up before starting the iOS Simulator");

		var future = new Future<void>();
		var killAllProc = this.$childProcess.spawn("killall", ["launchd_sim"]);
		killAllProc.on("close", (code: number) => {
			future.return();
		});
		return future;
	}

	private startEmulatorCore(app: string, emulatorOptions?: Mobile.IEmulatorOptions): void {
		this.$logger.info("Starting iOS Simulator");
		var iosSimPath = require.resolve("ios-sim-portable");
		var nodeCommandName = process.argv[0];

		if(options.availableDevices) {
			this.$childProcess.spawnFromEvent(nodeCommandName, [iosSimPath, "device-types"], "close", { stdio: "inherit" }).wait();
			return;
		}

		var opts = [
			iosSimPath,
			"launch", app,
			"--timeout", options.timeout,
			"--exit"
		];

		if(emulatorOptions) {
			if(emulatorOptions.stderrFilePath) {
				opts = opts.concat("--stderr", emulatorOptions.stderrFilePath);
			}
			if(emulatorOptions.stdoutFilePath) {
				opts = opts.concat("--stdout", emulatorOptions.stdoutFilePath);
			}
		}

		if(options.device) {
			opts = opts.concat("--device", options.device);
		}

		this.$childProcess.spawn(nodeCommandName, opts, { stdio: "inherit"});
	}
}
$injector.register("iOSEmulatorServices", IosEmulatorServices);
