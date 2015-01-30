///<reference path="../../.d.ts"/>
"use strict";

import options = require("../options");
import hostInfo = require("../host-info");

export class PostInstallCommand implements ICommand {
	private static MISSING_LINUX_32BITS_LIBS_MESSAGE = "It looks like you are using x64 Linux OS, but you are missing some of the required 32bits libraries." +
		"You can find all system requirements on http://docs.telerik.com/platform/appbuilder/running-appbuilder/running-the-cli/system-requirements-cli#linux-systems";

	constructor(private $autoCompletionService: IAutoCompletionService,
		private $fs: IFileSystem,
		private $staticConfig: Config.IStaticConfig,
		private $childProcess: IChildProcess,
		private $errors: IErrors) {
	}

	public disableAnalytics = true;
	public allowedParameters: ICommandParameter[] = [];

	private checkLinux32bitsLibrariesConfiguration(): IFuture<void> {
		return (() => {
			try {
				var proc = this.$childProcess.spawnFromEvent(this.$staticConfig.sevenZipFilePath, ["-h"], "exit", undefined, { throwError: false }).wait();

				if(proc.stderr) {
					this.$errors.failWithoutHelp(PostInstallCommand.MISSING_LINUX_32BITS_LIBS_MESSAGE);
				}
			} catch(e) {
				var message: string = (e.code === "ENOENT") ? PostInstallCommand.MISSING_LINUX_32BITS_LIBS_MESSAGE : e.message;
				this.$errors.failWithoutHelp(message);
			}
		}).future<void>()();
	}

	public execute(args: string[]): IFuture<void> {
		return (() => {
			if(process.platform !== "win32") {
				// when running under 'sudo' we create a working dir with wrong owner (root) and it is no longer accessible for the user initiating the installation
				// patch the owner here
				if (process.env.SUDO_USER) {
					this.$fs.setCurrentUserAsOwner(options.profileDir, process.env.SUDO_USER).wait();
				}

				this.$fs.chmod(this.$staticConfig.adbFilePath, "0777").wait();
				this.$fs.chmod(this.$staticConfig.sevenZipFilePath, "0777").wait();
			}

			this.$autoCompletionService.enableAutoCompletion().wait();

			if(hostInfo.isLinux64()) {
				this.checkLinux32bitsLibrariesConfiguration().wait();
			}
		}).future<void>()();
	}
}
$injector.registerCommand("dev-post-install", PostInstallCommand);
