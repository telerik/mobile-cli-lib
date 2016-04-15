///<reference path="../.d.ts"/>
"use strict";

export class PostInstallCommand implements ICommand {

	constructor(private $fs: IFileSystem,
		private $staticConfig: Config.IStaticConfig,
		private $commandsService: ICommandsService,
		private $htmlHelpService: IHtmlHelpService,
		private $options: ICommonOptions,
		private $doctorService: IDoctorService,
		private $analyticsService: IAnalyticsService) {
	}

	public disableAnalytics = true;
	public allowedParameters: ICommandParameter[] = [];

	public execute(args: string[]): IFuture<void> {
		return (() => {
			if(process.platform !== "win32") {
				// when running under 'sudo' we create a working dir with wrong owner (root) and
				// it is no longer accessible for the user initiating the installation
				// patch the owner here
				if (process.env.SUDO_USER) {
					this.$fs.setCurrentUserAsOwner(this.$options.profileDir, process.env.SUDO_USER).wait();
				}
			}

			this.$htmlHelpService.generateHtmlPages().wait();

			let doctorResult = this.$doctorService.printWarnings({ trackResult: false }).wait();
			// Explicitly ask for confirmation of usage-reporting:
			this.$analyticsService.checkConsent().wait();

			this.$commandsService.tryExecuteCommand("autocomplete", []).wait();
			this.$analyticsService.track("InstallEnvironmentSetup", doctorResult ? "incorrect" : "correct").wait();
		}).future<void>()();
	}
}
$injector.registerCommand("dev-post-install", PostInstallCommand);
