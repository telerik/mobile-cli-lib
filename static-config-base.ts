///<reference path=".d.ts"/>
"use strict";

import * as path from "path";
import * as shelljs from "shelljs";
import * as os from "os";

export class StaticConfigBase implements Config.IStaticConfig {
	public PROJECT_FILE_NAME: string = null;
	public CLIENT_NAME: string = null;
	public ANALYTICS_API_KEY: string = null;
	public ANALYTICS_FEATURE_USAGE_TRACKING_API_KEY: string = null;
	public ANALYTICS_INSTALLATION_ID_SETTING_NAME: string = null;
	public TRACK_FEATURE_USAGE_SETTING_NAME: string = null;
	public ERROR_REPORT_SETTING_NAME: string = null;
	public APP_RESOURCES_DIR_NAME = "App_Resources";
	public COMMAND_HELP_FILE_NAME = 'command-help.json';
	public RESOURCE_DIR_PATH = __dirname;
	public START_PACKAGE_ACTIVITY_NAME: string;
	public SYS_REQUIREMENTS_LINK: string;
	public HTML_CLI_HELPERS_DIR: string;
	public version: string = null;
	public pathToPackageJson: string;

	protected _adbFilePath: string = null;

	constructor(protected $injector: IInjector) { }

	public get helpTextPath(): string {
		return null;
	}

	public getAdbFilePath(): IFuture<string> {
		return (() => {
			if (!this._adbFilePath) {
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

	private get adb(): Mobile.IAndroidDebugBridge {
		return this.$injector.resolve("adb");
	}

	private getAdbFilePathCore(): IFuture<string> {
		return ((): string => {
			let $childProcess: IChildProcess = this.$injector.resolve("$childProcess");

			try {
				// Do NOT use the adb wrapper because it will end blow up with Segmentation fault because the wrapper uses this method!!!
				let proc = $childProcess.spawnFromEvent("adb", ["version"], "exit", undefined, { throwError: false }).wait();

				if (proc.stderr) {
					return this.spawnPrivateAdb().wait();
				}
			} catch (e) {
				if (e.code === "ENOENT") {
					return this.spawnPrivateAdb().wait();
				}
			}

			return "adb";
		}).future<string>()();
	}

	/*
		Problem:
		1. Adb forks itself as a server which keeps running until adb kill-server is invoked or crashes
		2. On Windows running processes lock their image files due to memory mapping. Locked files prevent their parent directories from deletion and cannot be overwritten.
		3. Update and uninstall scenarios are broken
		Solution:
		- Copy adb and associated files into a temporary directory. Let this copy of adb run persistently
		- On Posix OSes, immediately delete the file to not take file space
		- Tie common lib version to updates of adb, so that when we integrate a newer adb we can use it
		- Adb is named differently on OSes and may have additional files. The code is hairy to accommodate these differences
	 */
	private spawnPrivateAdb(): IFuture<string> {
		return ((): string => {
			let $fs: IFileSystem = this.$injector.resolve("$fs");

			// prepare the directory to host our copy of adb
			let defaultAdbDirPath = path.join(__dirname, `resources/platform-tools/android/${process.platform}`);
			let commonLibVersion = require(path.join(__dirname, "package.json")).version;
			let tmpDir = path.join(os.tmpdir(), `telerik-common-lib-${commonLibVersion}`);
			$fs.createDirectory(tmpDir).wait();

			// copy the adb and associated files
			let targetAdb = path.join(tmpDir, "adb");
			shelljs.cp(path.join(defaultAdbDirPath, "*"), tmpDir); // deliberately ignore copy errors
			// adb loses its executable bit when packed inside electron asar file. Manually fix the issue
			shelljs.chmod("+x", targetAdb);

			// let adb start its global server
			this.adb.executeCommand(["start-server"], "exit").wait();

			return targetAdb;
		}).future<string>()();
	}

	public PATH_TO_BOOTSTRAP: string;
}
