///<reference path="../.d.ts"/>
"use strict";

require("./appbuilder-bootstrap");
$injector.require("messages", "./messages/messages");
$injector.require("logger", "./appbuilder/proton-logger");

import Future = require("fibers/future");
import {OptionsBase} from "../options";
$injector.require("staticConfig", "./appbuilder/proton-static-config");
$injector.register("config", {});
// Proton will track the features and exceptions, so no need of analyticsService here.
$injector.register("analyiticsService", {});
$injector.register("options", $injector.resolve(OptionsBase, {options: {}, defaultProfileDir: ""}));
$injector.requirePublicClass("deviceEmitter", "./appbuilder/device-emitter");
$injector.requirePublicClass("deviceLogProvider", "./appbuilder/device-log-provider");
import {installUncaughtExceptionListener} from "../errors";
installUncaughtExceptionListener();

$injector.register("emulatorSettingsService", {
	canStart(platform: string): IFuture<boolean> {
		return Future.fromResult(true);
	},
	minVersion(): number {
		return 10;
	}
});

// When debugging uncomment the lines below and comment the line #6 (requiring logger).
// $injector.require("logger", "./logger");
// $injector.resolve("logger").setLevel("TRACE");

// Mock as it is used in LiveSync logic to deploy on devices.
// When called from Proton we'll not deploy on device, just livesync.
$injector.register("deployHelper", {
	deploy: (platform?: string) => Future.fromResult()
});

$injector.require("liveSyncProvider", "./appbuilder/providers/livesync-provider");
$injector.requirePublic("liveSyncService", "./appbuilder/services/livesync/livesync-service");
$injector.require("project", "./appbuilder/project/project-base");
