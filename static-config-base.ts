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
	public START_PACKAGE_ACTIVITY_NAME: string;
	public SYS_REQUIREMENTS_LINK: string;
	public version: string = null;
	public get helpTextPath(): string {
		return null;
	}

	public get sevenZipFilePath(): string {
		return path.join(__dirname, util.format("resources/platform-tools/unzip/%s/7za", process.platform));
	}

	public get adbFilePath(): string {
		return path.join(__dirname, util.format("resources/platform-tools/android/%s/adb", process.platform));
	}

	public get MAN_PAGES_DIR(): string {
		return path.join(__dirname, "../../", "docs", "man_pages");
	}

	public get HTML_PAGES_DIR(): string {
		return path.join(__dirname, "../../", "docs", "html");
	}

	public get HTML_HELPERS_DIR(): string {
		return path.join(__dirname, "../../", "docs", "helpers");
	}
}
