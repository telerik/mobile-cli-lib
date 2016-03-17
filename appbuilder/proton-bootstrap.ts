///<reference path="../.d.ts"/>
"use strict";

require("../bootstrap");
$injector.require("messages", "./messages/messages");
// $injector.require("logger", "./appbuilder/proton-logger");

import Future = require("fibers/future");
import {OptionsBase} from "../options";
$injector.require("staticConfig", "./appbuilder/proton-static-config");
$injector.require("mobilePlatformsCapabilities", "./appbuilder/mobile-platforms-capabilities");
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
$injector.require("logger", "./logger");
$injector.resolve("logger").setLevel("TRACE");

// Mock as it is used in LiveSync logic to deploy on devices.
// When called from Proton we'll not deploy on device, just livesync.
$injector.register("deployHelper", {
	deploy: (platform?: string) => Future.fromResult()
});

$injector.require("projectConstants", "./appbuilder/project-constants");

import * as path from "path";
class Project {
	constructor(private $projectConstants: IProjectConstants,
	private $fs: IFileSystem) { }
	public projectDir: string;
	public getProjectDir(): IFuture<string> {
		return Future.fromResult(this.projectDir);
	}

	public get projectData(): any {
		if(this.projectDir) {
			let projectFile = path.join(this.projectDir, this.$projectConstants.PROJECT_FILE);
			let jsonContent = this.$fs.readJson(projectFile).wait();
			return jsonContent;
		}

		return null;
	}

	public get capabilities(): any {
		let projectData = this.projectData;
		if(projectData) {
			if(projectData.Framework && projectData.Framework.toLowerCase() === this.$projectConstants.TARGET_FRAMEWORK_IDENTIFIERS.NativeScript.toLowerCase()) {
				return {
					build: true,
					buildCompanion: true,
					deploy: true,
					simulate: false,
					livesync: true,
					livesyncCompanion: true,
					updateKendo: false,
					emulate: true,
					publish: false,
					uploadToAppstore: true,
					canChangeFrameworkVersion: true,
					imageGeneration: true,
					wp8Supported: false
				};
			} else if(projectData.Framework && projectData.Framework.toLowerCase() === this.$projectConstants.TARGET_FRAMEWORK_IDENTIFIERS.Cordova.toLowerCase()) {
				return {
					build: true,
					buildCompanion: true,
					deploy: true,
					simulate: true,
					livesync: true,
					livesyncCompanion: true,
					updateKendo: true,
					emulate: true,
					publish: false,
					uploadToAppstore: true,
					canChangeFrameworkVersion: true,
					imageGeneration: true,
					wp8Supported: true
				};
			}
		}

		return null;
	}
}
$injector.register("project", Project);

$injector.require("projectFilesProvider", "./appbuilder/providers/project-files-provider");
$injector.require("pathFilteringService", "./appbuilder/services/path-filtering");

$injector.requirePublic("liveSyncService", "./appbuilder/services/livesync/livesync-service");

$injector.require("liveSyncProvider", "./appbuilder/providers/livesync-provider");
$injector.require("androidLiveSyncServiceLocator", "./appbuilder/services/livesync/android-livesync-service");
$injector.require("iosLiveSyncServiceLocator", "./appbuilder/services/livesync/ios-livesync-service");
$injector.require("deviceAppDataProvider", "./appbuilder/providers/device-app-data-provider");
$injector.requirePublic("companionAppsService", "./appbuilder/services/livesync/companion-apps-service");
