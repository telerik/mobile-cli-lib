import * as helpers from "../helpers";
const cliGlobal = <ICliGlobal>global;
// HACK
cliGlobal.XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;
cliGlobal.XMLHttpRequest.prototype.withCredentials = false;
// HACK -end

export class AnalyticsServiceBase implements IAnalyticsService {
	private static MAX_WAIT_SENDING_INTERVAL = 30000; // in milliseconds
	private _eqatecMonitor: any;
	private analyticsStatuses: IDictionary<AnalyticsStatus> = {};
	private isAnalyticsStatusesInitialized = false;

	constructor(protected $logger: ILogger,
		protected $options: ICommonOptions,
		private $staticConfig: Config.IStaticConfig,
		private $prompter: IPrompter,
		private $userSettingsService: UserSettings.IUserSettingsService,
		private $analyticsSettingsService: IAnalyticsSettingsService,
		private $progressIndicator: IProgressIndicator,
		private $osInfo: IOsInfo) { }

	protected get acceptTrackFeatureSetting(): string {
		return `Accept${this.$staticConfig.TRACK_FEATURE_USAGE_SETTING_NAME}`;
	}

	public async checkConsent(): Promise<void> {
		if (await this.$analyticsSettingsService.canDoRequest()) {
			if (await this.isNotConfirmed(this.$staticConfig.TRACK_FEATURE_USAGE_SETTING_NAME) && helpers.isInteractive()) {
				this.$logger.out("Do you want to help us improve "
					+ this.$analyticsSettingsService.getClientName()
					+ " by automatically sending anonymous usage statistics? We will not use this information to identify or contact you."
					+ " You can read our official Privacy Policy at");
				let message = this.$analyticsSettingsService.getPrivacyPolicyLink();

				let trackFeatureUsage = await this.$prompter.confirm(message, () => true);
				await this.setStatus(this.$staticConfig.TRACK_FEATURE_USAGE_SETTING_NAME, trackFeatureUsage, true);
				if (!trackFeatureUsage) {
					// In case user selects to disable feature tracking, disable the exceptions reporting as well.
					await this.setStatus(this.$staticConfig.ERROR_REPORT_SETTING_NAME, trackFeatureUsage, true);
				}

				await this.checkConsentCore(trackFeatureUsage);
			}

			if (await this.isNotConfirmed(this.$staticConfig.ERROR_REPORT_SETTING_NAME)) {
				this.$logger.out(`Error reporting will be enabled. You can disable it by running '$ ${this.$staticConfig.CLIENT_NAME.toLowerCase()} error-reporting disable'.`);
				await this.setStatus(this.$staticConfig.ERROR_REPORT_SETTING_NAME, true);
			}
		}
	}

	public trackFeature(featureName: string): Promise<void> {
		let category = this.$options.analyticsClient ||
			(helpers.isInteractive() ? "CLI" : "Non-interactive");
		return this.track(category, featureName);
	}

	public async track(featureName: string, featureValue: string): Promise<void> {
		await this.initAnalyticsStatuses();
		this.$logger.trace(`Trying to track feature '${featureName}' with value '${featureValue}'.`);

		if (this.analyticsStatuses[this.$staticConfig.TRACK_FEATURE_USAGE_SETTING_NAME] === AnalyticsStatus.enabled) {
			await this.trackFeatureCore(`${featureName}.${featureValue}`);
		}
	}

	public async trackException(exception: any, message: string): Promise<void> {
		await this.initAnalyticsStatuses();
		this.$logger.trace(`Trying to track exception with message '${message}'.`);

		if (this.analyticsStatuses[this.$staticConfig.ERROR_REPORT_SETTING_NAME] === AnalyticsStatus.enabled
			&& await this.$analyticsSettingsService.canDoRequest()) {
			try {
				await this.start();

				if (this._eqatecMonitor) {
					this.$logger.printInfoMessageOnSameLine("Sending exception report (press Ctrl+C to stop)...");
					this._eqatecMonitor.trackException(exception, message);
					// Sending the exception might take a while.
					// As in most cases we exit immediately after exception is caught,
					// wait for tracking the exception.
					await this.$progressIndicator.showProgressIndicator(this.waitForSending(), 500);
				}
			} catch (e) {
				this.$logger.trace("Analytics exception: '%s'", e.toString());
			}
		}
	}

	public async setStatus(settingName: string, enabled: boolean, doNotTrackSetting?: boolean): Promise<void> {
		this.analyticsStatuses[settingName] = enabled ? AnalyticsStatus.enabled : AnalyticsStatus.disabled;
		await this.$userSettingsService.saveSetting(settingName, enabled.toString());

		if (!doNotTrackSetting) {
			await this.trackFeatureCore(`${settingName}.${enabled ? "enabled" : "disabled"}`);
		}

		if (this.analyticsStatuses[settingName] === AnalyticsStatus.disabled
			&& this.analyticsStatuses[settingName] === AnalyticsStatus.disabled) {
			this.tryStopEqatecMonitor();
		}
	}

	public async isEnabled(settingName: string): Promise<boolean> {
		let analyticsStatus = await this.getStatus(settingName);
		return analyticsStatus === AnalyticsStatus.enabled;
	}

	public tryStopEqatecMonitor(code?: string | number): void {
		if (this._eqatecMonitor) {
			// remove the listener for exit event and explicitly call stop of monitor
			process.removeListener("exit", this.tryStopEqatecMonitor);
			this._eqatecMonitor.stop();
			this._eqatecMonitor = null;
		}
	}

	public getStatusMessage(settingName: string, jsonFormat: boolean, readableSettingName: string): Promise<string> {
		if (jsonFormat) {
			return this.getJsonStatusMessage(settingName);
		}

		return this.getHumanReadableStatusMessage(settingName, readableSettingName);
	}

	protected async restartEqatecMonitor(projectApiKey: string): Promise<void> {
		this.tryStopEqatecMonitor();
		await this.start(projectApiKey);
	}

	protected checkConsentCore(trackFeatureUsage: boolean): Promise<void> {
		return this.trackFeatureCore(`${this.acceptTrackFeatureSetting}.${!!trackFeatureUsage}`);
	}

	protected async trackFeatureCore(featureTrackString: string): Promise<void> {
		try {
			if (await this.$analyticsSettingsService.canDoRequest()) {
				await this.start();
				if (this._eqatecMonitor) {
					this._eqatecMonitor.trackFeature(featureTrackString);
					await this.waitForSending();
				}
			}
		} catch (e) {
			this.$logger.trace("Analytics exception: '%s'", e.toString());
		}
	}

	private async getStatus(settingName: string): Promise<AnalyticsStatus> {
		if (!this.analyticsStatuses[settingName]) {
			let settingValue = await this.$userSettingsService.getSettingValue<string>(settingName);

			if (settingValue) {
				let isEnabled = helpers.toBoolean(settingValue);
				if (isEnabled) {
					this.analyticsStatuses[settingName] = AnalyticsStatus.enabled;
				} else {
					this.analyticsStatuses[settingName] = AnalyticsStatus.disabled;
				}
			} else {
				this.analyticsStatuses[settingName] = AnalyticsStatus.notConfirmed;
			}
		}

		return this.analyticsStatuses[settingName];
	}

	private async start(analyticsProjectKey?: string): Promise<void> {
		if (this._eqatecMonitor) {
			return;
		}

		require("../vendor/EqatecMonitor.min");
		analyticsProjectKey = analyticsProjectKey || this.$staticConfig.ANALYTICS_API_KEY;
		let settings = cliGlobal._eqatec.createSettings(analyticsProjectKey);
		settings.useHttps = false;
		settings.userAgent = this.getUserAgentString();
		settings.version = this.$staticConfig.version;
		settings.useCookies = false;
		settings.loggingInterface = {
			logMessage: this.$logger.trace.bind(this.$logger),
			logError: this.$logger.debug.bind(this.$logger)
		};

		this._eqatecMonitor = cliGlobal._eqatec.createMonitor(settings);

		let guid = await this.$userSettingsService.getSettingValue(this.$staticConfig.ANALYTICS_INSTALLATION_ID_SETTING_NAME);
		if (!guid) {
			guid = helpers.createGUID(false);
			await this.$userSettingsService.saveSetting(this.$staticConfig.ANALYTICS_INSTALLATION_ID_SETTING_NAME, guid);
		}
		this.$logger.trace("%s: %s", this.$staticConfig.ANALYTICS_INSTALLATION_ID_SETTING_NAME, guid.toString());
		this._eqatecMonitor.setInstallationID(guid);

		try {
			await this._eqatecMonitor.setUserID(await this.$analyticsSettingsService.getUserId());
			let currentCount = await this.$analyticsSettingsService.getUserSessionsCount(analyticsProjectKey);
			// increment with 1 every time and persist the new value so next execution will be marked as new session
			await this.$analyticsSettingsService.setUserSessionsCount(++currentCount, analyticsProjectKey);
			this._eqatecMonitor.setStartCount(currentCount);
		} catch (e) {
			// user not logged in. don't care.
			this.$logger.trace("Error while initializing eqatecMonitor", e);
		}

		this._eqatecMonitor.start();

		// End the session on process.exit only or in case user disables both usage tracking and exceptions tracking.
		process.on("exit", this.tryStopEqatecMonitor);

		await this.reportNodeVersion();
	}

	private async reportNodeVersion(): Promise<void> {
		let reportedVersion: string = process.version.slice(1).replace(/[.]/g, "_");
		await this.track("NodeJSVersion", reportedVersion);
	}

	private getUserAgentString(): string {
		let userAgentString: string;
		let osType = this.$osInfo.type();
		if (osType === "Windows_NT") {
			userAgentString = "(Windows NT " + this.$osInfo.release() + ")";
		} else if (osType === "Darwin") {
			userAgentString = "(Mac OS X " + this.$osInfo.release() + ")";
		} else {
			userAgentString = "(" + osType + ")";
		}

		return userAgentString;
	}

	private async isNotConfirmed(settingName: string): Promise<boolean> {
		let analyticsStatus = await this.getStatus(settingName);
		return analyticsStatus === AnalyticsStatus.notConfirmed;
	}

	private async getHumanReadableStatusMessage(settingName: string, readableSettingName: string): Promise<string> {
		let status: string = null;

		if (await this.isNotConfirmed(settingName)) {
			status = "disabled until confirmed";
		} else {
			status = AnalyticsStatus[await this.getStatus(settingName)];
		}

		return `${readableSettingName} is ${status}.`;
	}

	private async getJsonStatusMessage(settingName: string): Promise<string> {
		let status = await this.getStatus(settingName);
		let enabled = status === AnalyticsStatus.notConfirmed ? null : status === AnalyticsStatus.disabled ? false : true;
		return JSON.stringify({ enabled: enabled });
	}

	private async initAnalyticsStatuses(): Promise<void> {
		if (await this.$analyticsSettingsService.canDoRequest()) {
			if (!this.isAnalyticsStatusesInitialized) {
				this.$logger.trace("Initializing analytics statuses.");
				let settingsNames = [this.$staticConfig.TRACK_FEATURE_USAGE_SETTING_NAME, this.$staticConfig.ERROR_REPORT_SETTING_NAME];
				for (let settingsIndex = 0; settingsIndex < settingsNames.length; ++settingsIndex) {
					const settingName = settingsNames[settingsIndex];
					await this.getStatus(settingName);
				}

				this.isAnalyticsStatusesInitialized = true;
			}
			this.$logger.trace("Analytics statuses: ");
			this.$logger.trace(this.analyticsStatuses);
		}
	}

	private getIsSending(): boolean {
		return this._eqatecMonitor.status().isSending;
	}

	private waitForSending(): Promise<void> {
		return new Promise<void>((resolve, reject) => {
			let intervalTime = 1000;
			let remainingTime = AnalyticsServiceBase.MAX_WAIT_SENDING_INTERVAL;
			if (this.getIsSending()) {
				this.$logger.trace(`Waiting for analytics to send information. Will check in a ${intervalTime}ms.`);
				let interval = setInterval(() => {
					if (!this.getIsSending() || (remainingTime <= 0)) {
						clearInterval(interval);
						resolve();
					}
					remainingTime -= intervalTime;
					this.$logger.trace(`Waiting for analytics to send information. Will check in a ${intervalTime}ms. Remaining time is: ${remainingTime}`);
				}, intervalTime);
			} else {
				resolve();
			}
		});
	}
}

export enum AnalyticsStatus {
	enabled,
	disabled,
	notConfirmed
}
