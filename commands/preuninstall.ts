﻿///<reference path="../.d.ts"/>
"use strict";

import path = require("path");
import util = require("util");

export class PreUninstallCommand implements ICommand {
	private static ADB_RELATIVE_PATH = "../resources/platform-tools/android/%s/adb";

	constructor(private $fs: IFileSystem,
		private $childProcess: IChildProcess,
		private $logger: ILogger,
		private $options: ICommonOptions) { }
	public disableAnalytics = true;

	public allowedParameters: ICommandParameter[] = [];

	public execute(args: string[]): IFuture<void> {
		return (() => {
			let relativeAdbPath = util.format(PreUninstallCommand.ADB_RELATIVE_PATH, process.platform);
			let adbPath = path.join(__dirname, relativeAdbPath);

			let killAdbServerCommand = util.format("\"%s\" kill-server", adbPath);
			this.$logger.warn("Trying to kill adb server. Some running Android related operations may fail.");

			try {
				this.$childProcess.exec(killAdbServerCommand).wait();
			} catch(err) {
				this.$logger.trace(err);
				this.$logger.warn("Unable to kill adb server.");
			}

			this.$fs.deleteFile(path.join(this.$options.profileDir, "KillSwitches", "cli")).wait();
		}).future<void>()();
	}
}
$injector.registerCommand("dev-preuninstall", PreUninstallCommand);
