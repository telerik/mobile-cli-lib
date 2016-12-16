let queryString = require('querystring');
let https = require('https');

export class PostInstallCommand implements ICommand {

	constructor(private $fs: IFileSystem,
		private $staticConfig: Config.IStaticConfig,
		private $commandsService: ICommandsService,
		private $htmlHelpService: IHtmlHelpService,
		private $options: ICommonOptions,
		private $doctorService: IDoctorService,
		private $analyticsService: IAnalyticsService,
		private $prompter: IPrompter,
		private $userSettingsService: IUserSettingsService,
		private $logger: ILogger) {
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

			if(this.$staticConfig.INSTALLATION_SUCCESS_MESSAGE) {
				// Make sure the success message is separated with at least one line from all other messages.
				this.$logger.out();
				this.$logger.printMarkdown(this.$staticConfig.INSTALLATION_SUCCESS_MESSAGE);
			}

			if (!this.$userSettingsService.getSettingValue("EMAIL_REGISTERED").wait()) {
				let emailMessage = "Leave your e-mail address here to subscribe for NativeScript newsletter and product updates, tips and tricks (press Enter for blank):";
				let email = this.$prompter.getEmail(emailMessage).wait();
				this.sendEmail(email);
				this.$userSettingsService.saveSetting("EMAIL_REGISTERED", true).wait();
			}

		}).future<void>()();
	}

	private sendEmail(email: string): void {
		if (email) {

			let postData = queryString.stringify({
				'elqFormName': process.argv[2],
				'elqSiteID': '1325',
				'emailAddress': email,
				'elqCookieWrite': '0'
			});

			let options = {
				hostname: 's1325.t.eloqua.com',
				path: '/e/f2',
				method: 'POST',
				headers: {
					'Content-Type': 'application/x-www-form-urlencoded',
					'Content-Length': postData.length
				}
			};

		    let request = https.request(options);
		    request.write(postData);
    		request.end();
    	}
	}
}
$injector.registerCommand("dev-post-install", PostInstallCommand);
