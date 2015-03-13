///<reference path="../.d.ts"/>
"use strict";

import path = require("path");
import util = require("util");

export class ConfigBase implements Config.IConfig {
	constructor(protected $fs: IFileSystem) { }

	protected loadConfig(name: string): IFuture<any> {
		var configFileName = this.getConfigPath(name);
		return this.$fs.readJson(configFileName);
	}

	protected getConfigPath(filename: string): string {
		return path.join(__dirname, "../../config/", filename + ".json");
	}
}
