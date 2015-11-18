///<reference path="../.d.ts"/>
"use strict";

require("../bootstrap");

import {OptionsBase} from "../options";
$injector.require("staticConfig", "./appbuilder/proton-static-config");
$injector.register("mobilePlatformsCapabilities", {});
$injector.register("config", {});
// Proton will track the features and execptions, so no need of analyticsService here.
$injector.register("analyiticsService", {});
$injector.register("options", $injector.resolve(OptionsBase, {options: {}, defaultProfileDir: ""}));
$injector.requirePublicClass("deviceEmitter", "./appbuilder/device-emitter");
$injector.requirePublicClass("deviceLogProvider", "./appbuilder/device-log-provider");
$injector.require("messages", "./messages/messages");
import {installUncaughtExceptionListener} from "../errors";
installUncaughtExceptionListener();
$injector.register("deviceAppDataProvider", {
	createFactoryRules(): IDictionary<Mobile.IDeviceAppDataFactoryRule> {
		return {
				Android: {
					vanilla: ""
				},
				iOS: {
					vanilla: ""
				},
				WP8: {
					vanilla: ""
				}
			};
		}
	}
);
