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
	public ERROR_REPORT_SETTING_NAME: string = null;
	public START_PACKAGE_ACTIVITY_NAME: string;
	public SYS_REQUIREMENTS_LINK: string;
	public HTML_CLI_HELPERS_DIR: string;	
	public version: string = null;
	
	private _adbFilePath: string = null;
	
	constructor(protected $injector: IInjector) { }
	
	public get helpTextPath(): string {
		return null;
	}
	
	public getAdbFilePath(): IFuture<string> {
		return (() => {
			if(!this._adbFilePath) {
				this._adbFilePath = this.getAdbFilePathCore().wait();
			}
			
			return this._adbFilePath;
		}).future<string>()();
	}

	public get MAN_PAGES_DIR(): string {
		return path.join(__dirname, "../../", "docs", "man_pages");
	}

	public get HTML_PAGES_DIR(): string {
		return path.join(__dirname, "../../", "docs", "html");
	}

	public get HTML_COMMON_HELPERS_DIR(): string {
		return path.join(__dirname, "docs", "helpers");
	}
	
	public pathToPackageJson: string;
	
	private getAdbFilePathCore(): IFuture<string> {
		return ((): string => {
			let defaultAdbFilePath = path.join(__dirname, `resources/platform-tools/android/${process.platform}/adb`);
			let $childProcess: IChildProcess = this.$injector.resolve("$childProcess");
			
			try {
				let proc = $childProcess.spawnFromEvent("adb", ["version"], "exit", undefined, { throwError: false }).wait();
	
				if(proc.stderr) {
					return defaultAdbFilePath;
				}
			} catch(e) {
				if(e.code === "ENOENT") {
					return defaultAdbFilePath;
				}
			}
	
			return "adb";
		}).future<string>()();
	}
}
