///<reference path="../../.d.ts"/>
"use strict";

import Future = require("fibers/future");
import * as path from "path";
import { StartPackageActivityNames } from "../../mobile/constants";
export class Project implements Project.IProjectBase {
	constructor(private $cordovaProjectCapabilities: Project.ICapabilities,
		private $fs: IFileSystem,
		private $logger: ILogger,
		private $nativeScriptProjectCapabilities: Project.ICapabilities,
		private $projectConstants: Project.IConstants) { }

	public projectDir: string;
	public getProjectDir(): IFuture<string> {
		return Future.fromResult(this.projectDir);
	}

	public get projectData(): Project.IData {
		if(this.projectDir) {
			let projectFile = path.join(this.projectDir, this.$projectConstants.PROJECT_FILE);
			let jsonContent = this.$fs.readJson(projectFile).wait();
			this.$logger.trace("Project data is: ", jsonContent);
			return jsonContent;
		}

		return null;
	}

	public get capabilities(): Project.ICapabilities {
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

	// Will be set to new value on each deploy.
	public startPackageActivity = StartPackageActivityNames.CORDOVA;
}
$injector.register("project", Project);
