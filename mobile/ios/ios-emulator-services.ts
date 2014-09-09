///<reference path="../../../.d.ts"/>
"use strict";

import util = require("util");
import Future = require("fibers/future");
import hostInfo = require("../../../common/host-info");
import MobileHelper = require("./../mobile-helper");

class IosEmulatorServices implements Mobile.IEmulatorPlatformServices {
	constructor(private $logger: ILogger,
		private $emulatorSettingsService: Mobile.IEmulatorSettingsService,
		private $errors: IErrors,
		private $childProcess: IChildProcess) {}

	checkAvailability(dependsOnProject: boolean = true): IFuture<void> {
		return (() => {
			if (!hostInfo.isDarwin()) {
				this.$errors.fail("iOS Simulator is available only on Mac OS X.");
			}

			try {
				this.$childProcess.exec(util.format("which ", IosEmulatorServices.SimulatorLauncher)).wait();
			} catch(err) {
				this.$errors.fail("Unable to find ios-sim. Run `npm install -g ios-sim` to install it.");
			}

			var platform = MobileHelper.DevicePlatforms[MobileHelper.DevicePlatforms.iOS];
			if (dependsOnProject && !this.$emulatorSettingsService.canStart(platform).wait()) {
				this.$errors.fail("The current project does not target iOS and cannot be run in the iOS Simulator.");
			}
		}).future<void>()();
	}

	startEmulator(app: string, emulatorOptions?: Mobile.IEmulatorOptions) : IFuture<void> {
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

		var opts = [
			"launch", app,
			"--exit"
		];

		if (emulatorOptions) {
			if (emulatorOptions.stderrFilePath) {
				opts = opts.concat("--stderr", emulatorOptions.stderrFilePath);
			}
			if (emulatorOptions.stdoutFilePath) {
				opts = opts.concat("--stdout", emulatorOptions.stdoutFilePath);
			}
			if (emulatorOptions.deviceFamily) {
				opts = opts.concat("--family", emulatorOptions.deviceFamily);
			}
		}
		this.$childProcess.spawn(IosEmulatorServices.SimulatorLauncher, opts,
			{ stdio:  ["ignore", "ignore", "ignore"], detached: true }).unref();
	}

	private static SimulatorLauncher = "ios-sim";
}
$injector.register("iOSEmulatorServices", IosEmulatorServices);
