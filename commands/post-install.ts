///<reference path="../../.d.ts"/>
"use strict";

import options = require("../options");
import hostInfo = require("../host-info");
import util = require("util");

export class PostInstallCommand implements ICommand {
	private static SEVEN_ZIP_ERROR_MESSAGE = "It looks like there's a problem with your system configuration. " +
		"You can find all system requirements on %s"; 

	constructor(private $fs: IFileSystem,
		private $staticConfig: Config.IStaticConfig,
		private $childProcess: IChildProcess,
		private $commandsService: ICommandsService,
		private $htmlHelpService: IHtmlHelpService,
		private $sysInfo: ISysInfo,
		private $logger: ILogger) {
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
			}

			this.$htmlHelpService.generateHtmlPages().wait();

			var sysInfo = this.$sysInfo.getSysInfo();
			var isNativeScript = this.$staticConfig.CLIENT_NAME === "tns";
			if (isNativeScript) {
				this.printNSWarnings(sysInfo);
			} else {
				this.printAppBuilderWarnings(sysInfo);
			}

			this.checkSevenZip().wait();

			this.$commandsService.tryExecuteCommand("autocomplete", []).wait();
		}).future<void>()();
	}

	private printNSWarnings(sysInfo: ISysInfoData) {
		if (!sysInfo.adbVer) {
			this.$logger.warn("Cannot find adb in the path. The built-in one will be used, which may be incompatible with the latest Android SDK or Genymotion. Adjust system path to include adb from the latest Android SDK.");
		}
		if (!sysInfo.antVer) {
			this.$logger.warn("Cannot find ant. You cannot build Android projects. Download and install ant as described in the Android SDK documentation.");
		}
		if (!sysInfo.javaVer) {
			this.$logger.warn("Cannot find java. You cannot build Android projects and use Android Emulator. Install java as described in the Android SDK documentation.");
		}
		if (hostInfo.isDarwin() && !sysInfo.xcodeVer) {
			this.$logger.warn("Cannot find Xcode. You cannot build iOS projects and use the iOS Simulator. Install Xcode from the App Store.");
		}
		if (!sysInfo.itunesInstalled) {
			this.$logger.warn("iTunes is not installed. Commands for working with iOS devices will not work. Download and install iTunes from http://www.apple.com");
		}
	}

	private printAppBuilderWarnings(sysInfo: ISysInfoData) {
		if (!sysInfo.adbVer) {
			this.$logger.warn("Cannot find adb in the path. The built-in one will be used, which may be incompatible with the latest Android SDK or Genymotion. Adjust system path to include adb from the latest Android SDK.");
		}
		if (!sysInfo.javaVer) {
			this.$logger.warn("Cannot find java. You cannot use Android Emulator. Install java as described in the Android SDK documentation.");
		}
		if (!sysInfo.itunesInstalled) {
			this.$logger.warn("iTunes is not installed. Commands for working with iOS devices will not work. Download and install iTunes from http://www.apple.com");
		}
	}

	private checkSevenZip(): IFuture<void> {
		var sevenZipErrorMessage = util.format(PostInstallCommand.SEVEN_ZIP_ERROR_MESSAGE, this.$staticConfig.SYS_REQUIREMENTS_LINK);
		return this.$childProcess.tryExecuteApplication(this.$staticConfig.sevenZipFilePath, ["-h"], "exit", sevenZipErrorMessage);
	}
}
$injector.registerCommand("dev-post-install", PostInstallCommand);
