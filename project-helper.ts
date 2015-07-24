///<reference path=".d.ts"/>
"use strict";

import path = require("path");
import util = require("util");

export class ProjectHelper implements IProjectHelper {
	constructor(private $logger: ILogger,
		private $fs: IFileSystem,
		private $staticConfig: Config.IStaticConfig,
		private $errors: IErrors,
		private $options: ICommonOptions) { }

	private cachedProjectDir = "";

	public get projectDir(): string {
		if (this.cachedProjectDir !== "") {
			return this.cachedProjectDir;
		}
		this.cachedProjectDir = null;

		let projectDir = path.resolve(this.$options.path || ".");
		while (true) {
			this.$logger.trace("Looking for project in '%s'", projectDir);
			let projectFilePath = path.join(projectDir, this.$staticConfig.PROJECT_FILE_NAME);
			

			if (this.$fs.exists(projectFilePath).wait() && this.isProjectFileCorrect(projectFilePath)) {
				this.$logger.debug("Project directory is '%s'.", projectDir);
				this.cachedProjectDir = projectDir;
				break;
			}

			let dir = path.dirname(projectDir);
			if (dir === projectDir) {
				this.$logger.debug("No project found at or above '%s'.", this.$options.path || path.resolve("."));
				break;
			}
			projectDir = dir;
		}

		return this.cachedProjectDir;
	}

	public generateDefaultAppId(appName: string, baseAppId: string): string {
		let sanitizedName = this.sanitizeName(appName);
		if (sanitizedName) {
			if (/^\d+$/.test(sanitizedName)) {
				sanitizedName = "the" + sanitizedName;
			}
		} else {
			sanitizedName = "the";
		}

		return util.format("%s.%s", baseAppId, sanitizedName);
	}

	public sanitizeName(appName: string): string {
		let sanitizedName = _.filter(appName.split(""), (c) => /[a-zA-Z0-9]/.test(c)).join("");
		return sanitizedName;
	}
	
	private isProjectFileCorrect(projectFilePath: string): boolean {
		if(this.$staticConfig.CLIENT_NAME_KEY_IN_PROJECT_FILE) {
			try {
				let fileContent = this.$fs.readJson(projectFilePath).wait();
				let clientSpecificData = fileContent[this.$staticConfig.CLIENT_NAME_KEY_IN_PROJECT_FILE];
				return !!clientSpecificData;
			} catch(err) {
				this.$errors.failWithoutHelp("The project file is corrupted. Additional technical information: %s", err);
			}
		}
		
		return true;
	}
}
$injector.register("projectHelper", ProjectHelper);
