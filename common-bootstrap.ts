///<reference path=".d.ts"/>
"use strict";

require("./bootstrap");
$injector.requirePublicClass("deviceEmitter", "./mobile/mobile-core/deviceEmitter");

import {StaticConfigBase} from "./static-config-base";
import {OptionsBase} from "./options";

// TODO: Add real dependencies
$injector.register("logcatPrinter", {print: (str: string) => {
	// logcatPrinter should be implemented
}});
$injector.register("mobilePlatformsCapabilities", {});
$injector.register("config", {});
$injector.register("analyiticsService", {});
$injector.register("staticConfig", StaticConfigBase);
$injector.register("options", $injector.resolve(OptionsBase, {options: {}, defaultProfileDir: ""}));
