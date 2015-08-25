///<reference path="../../.d.ts"/>
"use strict";

import * as path from "path";
import future = require("fibers/future");

class Wp8EmulatorServices implements Mobile.IEmulatorPlatformServices {
	constructor(private $logger: ILogger,
		private $emulatorSettingsService: Mobile.IEmulatorSettingsService,
		private $errors: IErrors,
		private $childProcess: IChildProcess,
		private $devicePlatformsConstants: Mobile.IDevicePlatformsConstants,
		private $hostInfo: IHostInfo) { }

	public checkDependencies(): IFuture<void> {
		return future.fromResult();
	}

	checkAvailability(): IFuture<void> {
		return (() => {
			if (!this.$hostInfo.isWindows) {
				this.$errors.fail("Windows Phone Emulator is available only on Windows 8 or later.");
			}

			let platform = this.$devicePlatformsConstants.WP8;
			if (!this.$emulatorSettingsService.canStart(platform).wait()) {
				this.$errors.fail("The current project does not target Windows Phone 8 and cannot be run in the Windows Phone emulator.");
			}
		}).future<void>()();
	}

	startEmulator(app: string, emulatorOptions?: Mobile.IEmulatorOptions) : IFuture<void> {
		return (() => {
			this.$logger.info("Starting Windows Phone Emulator");
			let emulatorStarter = path.join(Wp8EmulatorServices.programFilesPath, Wp8EmulatorServices.WP8_LAUNCHER_PATH, Wp8EmulatorServices.WP8_LAUNCHER);
			this.$childProcess.spawn(emulatorStarter, ["/installlaunch", app, "/targetdevice:xd"], { stdio:  "ignore", detached: true }).unref();
		}).future<void>()();
	}

	private static get programFilesPath(): string {
		return (process.arch === "x64") ? process.env["PROGRAMFILES(X86)"] : process.env.ProgramFiles;
	}

	private static WP8_LAUNCHER = "XapDeployCmd.exe";
	private static WP8_LAUNCHER_PATH = "Microsoft SDKs\\Windows Phone\\v8.0\\Tools\\XAP Deployment";
}
$injector.register("wp8EmulatorServices", Wp8EmulatorServices);
