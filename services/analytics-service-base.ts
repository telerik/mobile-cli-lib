import * as helpers from "../helpers";
import { cache } from "../decorators";

const cliGlobal = <ICliGlobal>global;
// HACK
cliGlobal.XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;
cliGlobal.XMLHttpRequest.prototype.withCredentials = false;
// HACK -end

export class AnalyticsServiceBase implements IAnalyticsService {
	private static MAX_WAIT_SENDING_INTERVAL = 30000; // in milliseconds
	protected _eqatecMonitor: any;
	protected analyticsStatuses: IDictionary<AnalyticsStatus> = {};

	constructor(protected $logger: ILogger,
		protected $options: ICommonOptions,
		protected $staticConfig: Config.IStaticConfig,
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
			const initialTrackFeatureUsageStatus = await this.getStatus(this.$staticConfig.TRACK_FEATURE_USAGE_SETTING_NAME);
			let trackFeatureUsage = initialTrackFeatureUsageStatus === AnalyticsStatus.enabled;

			if (await this.isNotConfirmed(this.$staticConfig.TRACK_FEATURE_USAGE_SETTING_NAME) && helpers.isInteractive()) {
				this.$logger.out("Do you want to help us improve "
					+ this.$analyticsSettingsService.getClientName()
					+ " by automatically sending anonymous usage statistics? We will not use this information to identify or contact you."
					+ " You can read our official Privacy Policy at");

				const message = this.$analyticsSettingsService.getPrivacyPolicyLink();
				trackFeatureUsage = await this.$prompter.confirm(message, () => true);
				await this.setStatus(this.$staticConfig.TRACK_FEATURE_USAGE_SETTING_NAME, trackFeatureUsage);
				await this.checkConsentCore(trackFeatureUsage);
			}

			const isErrorReportingUnset = await this.isNotConfirmed(this.$staticConfig.ERROR_REPORT_SETTING_NAME);
			const isUsageReportingConfirmed = !await this.isNotConfirmed(this.$staticConfig.TRACK_FEATURE_USAGE_SETTING_NAME);
			if (isErrorReportingUnset && isUsageReportingConfirmed) {
				await this.setStatus(this.$staticConfig.ERROR_REPORT_SETTING_NAME, trackFeatureUsage);
			}
		}
	}

	public trackFeature(featureName: string): Promise<void> {
		const category = this.$options.analyticsClient ||
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

		if (this.analyticsStatuses[this.$staticConfig.ERROR_REPORT_SETTING_NAME] === AnalyticsStatus.enabled
			&& await this.$analyticsSettingsService.canDoRequest()) {
			try {
				this.$logger.trace(`Trying to track exception with message '${message}'.`);
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

	public async setStatus(settingName: string, enabled: boolean): Promise<void> {
		this.analyticsStatuses[settingName] = enabled ? AnalyticsStatus.enabled : AnalyticsStatus.disabled;
		await this.$userSettingsService.saveSetting(settingName, enabled.toString());

		if (this.analyticsStatuses[settingName] === AnalyticsStatus.disabled
			&& this.analyticsStatuses[settingName] === AnalyticsStatus.disabled) {
			this.tryStopEqatecMonitor();
		}
	}

	public async isEnabled(settingName: string): Promise<boolean> {
		const analyticsStatus = await this.getStatus(settingName);
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

	public async restartEqatecMonitor(analyticsAPIKey: string): Promise<void> {
		this.tryStopEqatecMonitor();
		const analyticsSettings = await this.getEqatecSettings(analyticsAPIKey);
		await this.startEqatecMonitor(analyticsSettings);
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

	protected async startEqatecMonitor(analyticsSettings: IEqatecInitializeData): Promise<void> {
		if (this._eqatecMonitor) {
			return;
		}

		require("../vendor/EqatecMonitor.min");
		const analyticsProjectKey = analyticsSettings.analyticsAPIKey;
		const settings = cliGlobal._eqatec.createSettings(analyticsProjectKey);
		settings.useHttps = false;
		settings.userAgent = this.getUserAgentString();
		settings.version = this.$staticConfig.version;
		settings.useCookies = false;
		settings.loggingInterface = {
			logMessage: this.$logger.trace.bind(this.$logger),
			logError: this.$logger.debug.bind(this.$logger)
		};

		this._eqatecMonitor = cliGlobal._eqatec.createMonitor(settings);

		const analyticsInstallationId = analyticsSettings.analyticsInstallationId;

		this.$logger.trace(`${this.$staticConfig.ANALYTICS_INSTALLATION_ID_SETTING_NAME}: ${analyticsInstallationId}`);
		this._eqatecMonitor.setInstallationID(analyticsInstallationId);

		try {
			await this._eqatecMonitor.setUserID(analyticsSettings.userId);

			const currentCount = analyticsSettings.userSessionCount;
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

	@cache()
	protected async initAnalyticsStatuses(): Promise<void> {
		if (await this.$analyticsSettingsService.canDoRequest()) {
			this.$logger.trace("Initializing analytics statuses.");
			const settingsNames = [this.$staticConfig.TRACK_FEATURE_USAGE_SETTING_NAME, this.$staticConfig.ERROR_REPORT_SETTING_NAME];

			for (const settingName of settingsNames) {
				await this.getStatus(settingName);
			}

			this.$logger.trace("Analytics statuses: ");
			this.$logger.trace(this.analyticsStatuses);
		}
	}

	protected getIsSending(): boolean {
		return this._eqatecMonitor.status().isSending;
	}

	protected waitForSending(): Promise<void> {
		return new Promise<void>((resolve, reject) => {
			const intervalTime = 100;
			let remainingTime = AnalyticsServiceBase.MAX_WAIT_SENDING_INTERVAL;

			if (this.getIsSending()) {
				this.$logger.trace(`Waiting for analytics to send information. Will check in ${intervalTime}ms.`);
				const interval = setInterval(() => {
					if (!this.getIsSending() || remainingTime <= 0) {
						clearInterval(interval);
						resolve();
					}

					remainingTime -= intervalTime;
					this.$logger.trace(`Waiting for analytics to send information. Will check in ${intervalTime}ms. Remaining time is: ${remainingTime}`);
				}, intervalTime);
			} else {
				resolve();
			}
		});
	}

	private async getDefaultEqatecInstallationId(): Promise<string> {
		let guid = await this.$userSettingsService.getSettingValue<string>(this.$staticConfig.ANALYTICS_INSTALLATION_ID_SETTING_NAME);
		if (!guid) {
			guid = helpers.createGUID(false);
			await this.$userSettingsService.saveSetting(this.$staticConfig.ANALYTICS_INSTALLATION_ID_SETTING_NAME, guid);
		}

		return guid;
	}

	private async getCurrentSessionCount(analyticsProjectKey: string): Promise<number> {
		let currentCount = await this.$analyticsSettingsService.getUserSessionsCount(analyticsProjectKey);
		await this.$analyticsSettingsService.setUserSessionsCount(++currentCount, analyticsProjectKey);

		return currentCount;
	}

	private async getEqatecSettings(analyticsAPIKey?: string): Promise<IEqatecInitializeData> {
		return {
			analyticsAPIKey: analyticsAPIKey || this.$staticConfig.ANALYTICS_API_KEY,
			analyticsInstallationId: await this.getDefaultEqatecInstallationId(),
			type: TrackingTypes.Initialization,
			userId: await this.$analyticsSettingsService.getUserId(),
			userSessionCount: await this.getCurrentSessionCount(analyticsAPIKey)
		};
	}

	private async getStatus(settingName: string): Promise<AnalyticsStatus> {
		if (!_.has(this.analyticsStatuses, settingName)) {
			const settingValue = await this.$userSettingsService.getSettingValue<string>(settingName);

			if (settingValue) {
				const isEnabled = helpers.toBoolean(settingValue);
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

	private async start(analyticsAPIKey?: string): Promise<void> {
		const analyticsSettings = await this.getEqatecSettings(analyticsAPIKey);
		await this.startEqatecMonitor(analyticsSettings);
	}

	private async reportNodeVersion(): Promise<void> {
		const reportedVersion: string = process.version.slice(1).replace(/[.]/g, "_");
		await this.trackFeatureCore(`NodeJSVersion.${reportedVersion}`);
	}

	private getUserAgentString(): string {
		let userAgentString: string;
		const osType = this.$osInfo.type();
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
		const analyticsStatus = await this.getStatus(settingName);
		return analyticsStatus === AnalyticsStatus.notConfirmed;
	}

	private async getHumanReadableStatusMessage(settingName: string, readableSettingName: string): Promise<string> {
		let status: string = null;

		if (await this.isNotConfirmed(settingName)) {
			status = "disabled until confirmed";
		} else {
			status = await this.getStatus(settingName);
		}

		return `${readableSettingName} is ${status}.`;
	}

	private async getJsonStatusMessage(settingName: string): Promise<string> {
		const status = await this.getStatus(settingName);
		const enabled = status === AnalyticsStatus.notConfirmed ? null : status === AnalyticsStatus.enabled;
		return JSON.stringify({ enabled });
	}

}
