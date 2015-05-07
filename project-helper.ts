///<reference path="../.d.ts"/>

import path = require("path");
import options = require("./options");
import util = require("util");

export class ProjectHelper implements IProjectHelper {
	constructor(private $logger: ILogger,
		private $fs: IFileSystem,
		private $staticConfig: Config.IStaticConfig) { }

	private cachedProjectDir = "";

	public get projectDir(): string {
		if (this.cachedProjectDir !== "") {
			return this.cachedProjectDir;
		}
		this.cachedProjectDir = null;

		let projectDir = path.resolve(options.path || ".");
		while (true) {
			this.$logger.trace("Looking for project in '%s'", projectDir);

			if (this.$fs.exists(path.join(projectDir, this.$staticConfig.PROJECT_FILE_NAME)).wait()) {
				this.$logger.debug("Project directory is '%s'.", projectDir);
				this.cachedProjectDir = projectDir;
				break;
			}

			let dir = path.dirname(projectDir);
			if (dir === projectDir) {
				this.$logger.debug("No project found at or above '%s'.", path.resolve("."));
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
}
$injector.register("projectHelper", ProjectHelper);
