///<reference path="../../.d.ts"/>
"use strict";

import Future = require("fibers/future");
import * as path from "path";
export class Project implements IProjectBase {
	constructor(private $cordovaProjectCapabilities: IProjectCapabilities,
		private $fs: IFileSystem,
		private $logger: ILogger,
		private $nativeScriptProjectCapabilities: IProjectCapabilities,
		private $projectConstants: IProjectConstants) { }

	public projectDir: string;
	public getProjectDir(): IFuture<string> {
		return Future.fromResult(this.projectDir);
	}
	// TODO: Move IProjectData to common
	public get projectData(): IProjectData {
		if(this.projectDir) {
			let projectFile = path.join(this.projectDir, this.$projectConstants.PROJECT_FILE);
			let jsonContent = this.$fs.readJson(projectFile).wait();
			this.$logger.trace("Project data is: ", jsonContent);
			return jsonContent;
		}

		return null;
	}

	public get capabilities(): IProjectCapabilities {
		let projectData = this.projectData;
		if(projectData) {
			if(projectData.Framework && projectData.Framework.toLowerCase() === this.$projectConstants.TARGET_FRAMEWORK_IDENTIFIERS.NativeScript.toLowerCase()) {
				return this.$nativeScriptProjectCapabilities;
			} else if(projectData.Framework && projectData.Framework.toLowerCase() === this.$projectConstants.TARGET_FRAMEWORK_IDENTIFIERS.Cordova.toLowerCase()) {
				return this.$cordovaProjectCapabilities;
			}
		}

		return null;
	}
}
$injector.register("project", Project);
