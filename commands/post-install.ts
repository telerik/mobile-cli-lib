export class PostInstallCommand implements ICommand {
	constructor(private $fs: IFileSystem,
		private $staticConfig: Config.IStaticConfig,
		private $commandsService: ICommandsService,
		private $htmlHelpService: IHtmlHelpService,
		private $options: ICommonOptions,
		private $doctorService: IDoctorService,
		private $analyticsService: IAnalyticsService,
		private $logger: ILogger) {
	}

	public disableAnalytics = true;
	public allowedParameters: ICommandParameter[] = [];

	public async execute(args: string[]): Promise<void> {
		if (process.platform !== "win32") {
			// when running under 'sudo' we create a working dir with wrong owner (root) and
			// it is no longer accessible for the user initiating the installation
			// patch the owner here
			if (process.env.SUDO_USER) {
				await this.$fs.setCurrentUserAsOwner(this.$options.profileDir, process.env.SUDO_USER);
			}
		}

		await this.$htmlHelpService.generateHtmlPages();

		let doctorResult = await this.$doctorService.printWarnings({ trackResult: false });
		// Explicitly ask for confirmation of usage-reporting:
		await this.$analyticsService.checkConsent();

		await this.$commandsService.tryExecuteCommand("autocomplete", []);
		await this.$analyticsService.track("InstallEnvironmentSetup", doctorResult ? "incorrect" : "correct");

		if (this.$staticConfig.INSTALLATION_SUCCESS_MESSAGE) {
			// Make sure the success message is separated with at least one line from all other messages.
			this.$logger.out();
			this.$logger.printMarkdown(this.$staticConfig.INSTALLATION_SUCCESS_MESSAGE);
		}
	}
}
$injector.registerCommand("dev-post-install", PostInstallCommand);
