///<reference path="../../../.d.ts"/>
"use strict";

import util = require("util");
import hostInfo = require("../../../common/host-info");
import MobileHelper = require("./../mobile-helper");

class IosEmulatorServices implements Mobile.IEmulatorPlatformServices {
	constructor(private $logger: ILogger,
		private $emulatorSettingsService: Mobile.IEmulatorSettingsService,
		private $errors: IErrors,
		private $childProcess: IChildProcess) {}

	checkAvailability(): IFuture<void> {
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
			if (!this.$emulatorSettingsService.canStart(platform).wait()) {
				this.$errors.fail("The current project does not target iOS and cannot be run in the iOS Simulator.");
			}
		}).future<void>()();
	}

	startEmulator(image: string) : IFuture<void> {
		return (() => {
			this.$logger.info("Starting iOS Simulator");
			this.$childProcess.spawn(IosEmulatorServices.SimulatorLauncher, ["launch", image],
				{ stdio:  ["ignore", "ignore", "ignore"], detached: true }).unref();
		}).future<void>()();
	}

	private static SimulatorLauncher = "ios-sim";
}
$injector.register("iOSEmulatorServices", IosEmulatorServices);