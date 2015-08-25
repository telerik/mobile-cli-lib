///<reference path=".d.ts"/>
"use strict";

require("./bootstrap");

import {StaticConfigBase} from "./static-config-base";

$injector.require("staticConfig", "./static-config-base");

// TODO: Add real dependencies
$injector.register("logcatPrinter", {print: (str: string) => {}});
$injector.register("mobilePlatformsCapabilities", {});
$injector.register("config", {});
$injector.register("analyiticsService", {});
$injector.register("staticConfig", StaticConfigBase);
