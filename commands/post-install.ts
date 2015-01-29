///<reference path="../../.d.ts"/>
"use strict";

import options = require("../../common/options");

export class PostInstallCommand implements ICommand {
	constructor(private $autoCompletionService: IAutoCompletionService,
		private $fs: IFileSystem,
		private $resourceConstants: IResourceConstants) {
	}

	public disableAnalytics = true;
	public allowedParameters: ICommandParameter[] = [];

	public execute(args: string[]): IFuture<void> {
		return (() => {
			if(process.platform !== "win32") {
				// when running under 'sudo' we create a working dir with wrong owner (root) and it is no longer accessible for the user initiating the installation
				// patch the owner here
				if (process.env.SUDO_USER) {
					this.$fs.setCurrentUserAsOwner(options.profileDir, process.env.SUDO_USER).wait();
				}

				this.$fs.chmod(this.$resourceConstants.ADB_FILE_PATH, "0777").wait();
				this.$fs.chmod(this.$resourceConstants.SEVEN_ZIP_FILE_PATH, "0777").wait();
			}

			this.$autoCompletionService.enableAutoCompletion().wait();
		}).future<void>()();
	}
}
$injector.registerCommand("dev-post-install", PostInstallCommand);
