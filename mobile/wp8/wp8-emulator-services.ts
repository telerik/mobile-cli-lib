///<reference path="./../../../.d.ts"/>
"use strict";

import path = require("path");
import hostInfo = require("../../host-info");

class Wp8EmulatorServices implements Mobile.IEmulatorPlatformServices {
	constructor(private $logger: ILogger,
		private $emulatorSettingsService: Mobile.IEmulatorSettingsService,
		private $errors: IErrors,
		private $childProcess: IChildProcess,
		private $devicePlatformsConstants: Mobile.IDevicePlatformsConstants) { }

	public checkDependencies(): IFuture<void> {
		return (() => {
		}).future<void>()();
	}

	checkAvailability(): IFuture<void> {
		return (() => {
			if (!hostInfo.isWindows()) {
				this.$errors.fail("Windows Phone Emulator is available only on Windows 8 or later.");
			}

			var platform = this.$devicePlatformsConstants.WP8;
			if (!this.$emulatorSettingsService.canStart(platform).wait()) {
				this.$errors.fail("The current project does not target Windows Phone 8 and cannot be run in the Windows Phone emulator.");
			}
		}).future<void>()();
	}

	startEmulator(app: string, emulatorOptions?: Mobile.IEmulatorOptions) : IFuture<void> {
		return (() => {
			this.$logger.info("Starting Windows Phone Emulator");
			var emulatorStarter = path.join(process.env.ProgramFiles, Wp8EmulatorServices.WP8_LAUNCHER_PATH, Wp8EmulatorServices.WP8_LAUNCHER);
			this.$childProcess.spawn(emulatorStarter, ["/installlaunch", app, "/targetdevice:xd"], { stdio:  ["ignore", "ignore", "ignore"], detached: true }).unref();
		}).future<void>()();
	}

	private static WP8_LAUNCHER = "XapDeployCmd.exe";
	private static WP8_LAUNCHER_PATH = "Microsoft SDKs\\Windows Phone\\v8.0\\Tools\\XAP Deployment";
}
$injector.register("wp8EmulatorServices", Wp8EmulatorServices);