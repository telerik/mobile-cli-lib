///<reference path="../../../.d.ts"/>
"use strict";

import util = require("util");
import Future = require("fibers/future");

class IosEmulatorServices implements Mobile.IEmulatorPlatformServices {
	constructor(private $logger: ILogger,
		private $emulatorSettingsService: Mobile.IEmulatorSettingsService,
		private $errors: IErrors,
		private $childProcess: IChildProcess,
		private $mobileHelper: Mobile.IMobileHelper,
		private $devicePlatformsConstants: Mobile.IDevicePlatformsConstants,
		private $hostInfo: IHostInfo,
		private $options: IOptions) { }

	public checkDependencies(): IFuture<void> {
		return (() => {
		}).future<void>()();
	}

	checkAvailability(dependsOnProject: boolean = true): IFuture<void> {
		return (() => {
			if(!this.$hostInfo.isDarwin) {
				this.$errors.fail("iOS Simulator is available only on Mac OS X.");
			}

			let platform = this.$devicePlatformsConstants.iOS;
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

	public postDarwinNotification(notification: string): IFuture<void> {
		let iosSimPath = require.resolve("ios-sim-portable");
		let nodeCommandName = process.argv[0];

		let opts = [ "notify-post", notification ];

		if (this.$options.device) {
			opts.push("--device", this.$options.device);
		}

		return this.$childProcess.exec(`${nodeCommandName} ${iosSimPath} ${opts.join(' ')}`);
	}

	private killLaunchdSim(): IFuture<void> {
		this.$logger.info("Cleaning up before starting the iOS Simulator");

		let future = new Future<void>();
		let killAllProc = this.$childProcess.spawn("killall", ["launchd_sim"]);
		killAllProc.on("close", (code: number) => {
			future.return();
		});
		return future;
	}

	private startEmulatorCore(app: string, emulatorOptions?: Mobile.IEmulatorOptions): void {
		this.$logger.info("Starting iOS Simulator");
		let iosSimPath = require.resolve("ios-sim-portable");
		let nodeCommandName = process.argv[0];

		if(this.$options.availableDevices) {
			this.$childProcess.spawnFromEvent(nodeCommandName, [iosSimPath, "device-types"], "close", { stdio: "inherit" }).wait();
			return;
		}

		let opts = [
			iosSimPath,
			"launch", app,
			"--timeout", this.$options.timeout
		];

		if(!this.$options.justlaunch) {
			opts.push("--logging");
		} else {
			if(emulatorOptions) {
				if(emulatorOptions.stderrFilePath) {
					opts = opts.concat("--stderr", emulatorOptions.stderrFilePath);
				}
				if(emulatorOptions.stdoutFilePath) {
					opts = opts.concat("--stdout", emulatorOptions.stdoutFilePath);
				}
			}

			opts.push("--exit");
		}

		if(this.$options.device) {
			opts = opts.concat("--device", this.$options.device);
		}

		if(emulatorOptions.args) {
			opts.push(`--args=${emulatorOptions.args}`);
		}

		this.$childProcess.spawn(nodeCommandName, opts, { stdio: "inherit" });
	}
}
$injector.register("iOSEmulatorServices", IosEmulatorServices);

export = IosEmulatorServices;