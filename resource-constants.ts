///<reference path="../.d.ts"/>
"use strict";

import path = require("path");
import util = require("util");

export class ResourceConstants implements IResourceConstants {
	public ADB_FILE_PATH = path.join(__dirname, util.format("resources/platform-tools/android/%s/adb", process.platform));
	public SEVEN_ZIP_FILE_PATH = path.join(__dirname, util.format("resources/platform-tools/unzip/%s/7za", process.platform));
}
$injector.register("resourceConstants", ResourceConstants);