///<reference path="../.d.ts"/>
"use strict";

import path = require("path");
import util = require("util");

export class StaticConfigBase implements Config.IStaticConfig {
	public PROJECT_FILE_NAME: string = null;
	public CLIENT_NAME: string = null;
	public ANALYTICS_API_KEY: string = null;
	public ANALYTICS_INSTALLATION_ID_SETTING_NAME: string = null;
	public TRACK_FEATURE_USAGE_SETTING_NAME: string = null;
	public START_PACKAGE_ACTIVITY_NAME: string = null;
	public version: string = null;
	public get helpTextPath(): string {
		return null;
	}

	public get sevenZipFilePath(): string {
		return null;
	}

	public get adbFilePath(): string {
		return path.join(__dirname, util.format("resources/platform-tools/android/%s/adb", process.platform));
	}
}