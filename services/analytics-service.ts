///<reference path="../.d.ts"/>
"use strict";

import * as helpers from "../helpers";
import * as os from "os";
// HACK
global.XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;
global.XMLHttpRequest.prototype.withCredentials = false;
// HACK -end

export class AnalyticsService implements IAnalyticsService {
	private _eqatecMonitor: any;
	private analyticsStatuses: IDictionary<AnalyticsStatus> = {};
	private isAnalyticsStatusesInitialized = false;

	constructor(private $staticConfig: Config.IStaticConfig,
		private $logger: ILogger,
		private $errors: IErrors,
		private $prompter: IPrompter,
		private $userSettingsService: UserSettings.IUserSettingsService,
		private $analyticsSettingsService: IAnalyticsSettingsService,
		private $options: ICommonOptions) {}

	public checkConsent(): IFuture<void> {
		return ((): void => {
			if(this.$analyticsSettingsService.canDoRequest().wait()) {

				if(this.isNotConfirmed(this.$staticConfig.TRACK_FEATURE_USAGE_SETTING_NAME).wait() && helpers.isInteractive()) {
					this.$logger.out("Do you want to help us improve "
						+ this.$analyticsSettingsService.getClientName()
						+ " by automatically sending anonymous usage statistics? We will not use this information to identify or contact you."
						+ " You can read our official Privacy Policy at");
					let message = this.$analyticsSettingsService.getPrivacyPolicyLink();

					let trackFeatureUsage = this.$prompter.confirm(message, () => true).wait();
					this.setStatus(this.$staticConfig.TRACK_FEATURE_USAGE_SETTING_NAME, trackFeatureUsage).wait();
				}

				if(this.isNotConfirmed(this.$staticConfig.ERROR_REPORT_SETTING_NAME).wait()) {
					this.$logger.out(`Error reporting will be enabled. You can disable it by running '$ ${this.$staticConfig.CLIENT_NAME.toLowerCase()} error-reporting disable'.`);
					this.setStatus(this.$staticConfig.ERROR_REPORT_SETTING_NAME, true).wait();
				}
			}
		}).future<void>()();
	}

	public trackFeature(featureName: string): IFuture<void> {
		let category = this.$options.analyticsClient ||
						(helpers.isInteractive() ? "CLI" : "Non-interactive");
		return this.track(category, featureName);
	}

	public track(featureName: string, featureValue: string): IFuture<void> {
		return (() => {
			this.initAnalyticsStatuses().wait();
			this.$logger.trace(`Trying to track feature '${featureName}' with value '${featureValue}'.`);

			if(this.analyticsStatuses[this.$staticConfig.TRACK_FEATURE_USAGE_SETTING_NAME] !== AnalyticsStatus.disabled &&
				this.$analyticsSettingsService.canDoRequest().wait()) {
				try {
					this.start().wait();
					if(this._eqatecMonitor) {
						this._eqatecMonitor.trackFeature(`${featureName}.${featureValue}`);
					}
				} catch(e) {
					this.$logger.trace("Analytics exception: '%s'", e.toString());
				}
			}
		}).future<void>()();
	}

	public trackException(exception: any, message: string): IFuture<void> {
		return (() => {
			this.initAnalyticsStatuses().wait();
			this.$logger.trace(`Trying to track exception with message '${message}'.`);

			if(this.analyticsStatuses[this.$staticConfig.ERROR_REPORT_SETTING_NAME] !== AnalyticsStatus.disabled &&
				this.$analyticsSettingsService.canDoRequest().wait()) {
				try {
					this.start().wait();

					if(this._eqatecMonitor) {
						this._eqatecMonitor.trackException(exception, message);
					}

				} catch(e) {
					this.$logger.trace("Analytics exception: '%s'", e.toString());
				}
			}
		}).future<void>()();
	}

	public setStatus(settingName: string, enabled: boolean): IFuture<void> {
		return (() => {
			this.analyticsStatuses[settingName] = enabled ? AnalyticsStatus.enabled : AnalyticsStatus.disabled;
			this.$userSettingsService.saveSetting(settingName, enabled.toString()).wait();
			if(this.analyticsStatuses[settingName] === AnalyticsStatus.disabled
				&& this.analyticsStatuses[settingName] === AnalyticsStatus.disabled
				&& this._eqatecMonitor) {
				this._eqatecMonitor.stop();
			}
		}).future<void>()();
	}

	private getStatus(settingName: string): IFuture<AnalyticsStatus> {
		return (() => {
			if(!this.analyticsStatuses[settingName]) {
				let settingValue = this.$userSettingsService.getSettingValue<string>(settingName).wait();

				if(settingValue) {
					let isEnabled = helpers.toBoolean(settingValue);
					if(isEnabled) {
						this.analyticsStatuses[settingName] = AnalyticsStatus.enabled;
					} else {
						this.analyticsStatuses[settingName] = AnalyticsStatus.disabled;
					}
				} else {
					this.analyticsStatuses[settingName] = AnalyticsStatus.notConfirmed;
				}
			}

			return this.analyticsStatuses[settingName];
		}).future<AnalyticsStatus>()();
	}

	private start(): IFuture<void> {
		return (() => {
			if(this._eqatecMonitor || this.isEverythingDisabled()) {
				return;
			}

			require("../vendor/EqatecMonitor");

			let settings = global._eqatec.createSettings(this.$staticConfig.ANALYTICS_API_KEY);
			settings.useHttps = false;
			settings.userAgent = this.getUserAgentString();
			settings.version = this.$staticConfig.version;
			settings.loggingInterface = {
				logMessage: this.$logger.trace.bind(this.$logger),
				logError: this.$logger.debug.bind(this.$logger)
			};

			this._eqatecMonitor = global._eqatec.createMonitor(settings);

			let guid = this.$userSettingsService.getSettingValue(this.$staticConfig.ANALYTICS_INSTALLATION_ID_SETTING_NAME).wait();
			if(!guid) {
				guid = helpers.createGUID(false);
				this.$userSettingsService.saveSetting(this.$staticConfig.ANALYTICS_INSTALLATION_ID_SETTING_NAME, guid).wait();
			}
			this.$logger.trace("%s: %s", this.$staticConfig.ANALYTICS_INSTALLATION_ID_SETTING_NAME, guid.toString());
			this._eqatecMonitor.setInstallationID(guid);

			try {
				this._eqatecMonitor.setUserID(this.$analyticsSettingsService.getUserId().wait());
			} catch(e) {
				// user not logged in. don't care.
			}

			this._eqatecMonitor.start();

			this.reportNodeVersion();
		}).future<void>()();
	}

	private reportNodeVersion() {
		let reportedVersion: string = process.version.slice(1).replace(/[.]/g, "_");
		this._eqatecMonitor.trackFeature("NodeJSVersion." + reportedVersion);
	}

	private getUserAgentString(): string {
		let userAgentString: string;
		let osType = os.type();
		if(osType === "Windows_NT") {
			userAgentString = "(Windows NT " + os.release() + ")";
		} else if(osType === "Darwin") {
			userAgentString = "(Mac OS X " + os.release() + ")";
		} else {
			userAgentString = "(" + osType +")";
		}

		return userAgentString;
	}

	public isEnabled(settingName: string): IFuture<boolean> {
		return (() => {
			let analyticsStatus = this.getStatus(settingName).wait();
			return analyticsStatus === AnalyticsStatus.enabled;
		}).future<boolean>()();
	}

	private isNotConfirmed(settingName: string): IFuture<boolean> {
		return (() => {
			let analyticsStatus = this.getStatus(settingName).wait();
			return analyticsStatus === AnalyticsStatus.notConfirmed;
		}).future<boolean>()();
	}

	public getStatusMessage(settingName: string, jsonFormat: boolean, readableSettingName: string): IFuture<string> {
		if(jsonFormat) {
			return this.getJsonStatusMessage(settingName);
		}

		return this.getHumanReadableStatusMessage(settingName, readableSettingName);
	}

	private getHumanReadableStatusMessage(settingName: string, readableSettingName: string): IFuture<string> {
		return (() => {
			let status: string = null;

			if(this.isNotConfirmed(settingName).wait()) {
				status = "disabled until confirmed";
			} else {
				status = AnalyticsStatus[this.getStatus(settingName).wait()];
			}

			return `${readableSettingName} is ${status}.`;
		}).future<string>()();
	}

	private getJsonStatusMessage(settingName: string): IFuture<string> {
		return (() => {
			let status = this.getStatus(settingName).wait();
			let enabled = status === AnalyticsStatus.notConfirmed ? null : status === AnalyticsStatus.disabled ? false : true;
			return JSON.stringify({ enabled: enabled });
		}).future<string>()();
	}

	private isEverythingDisabled(): boolean {
		let statuses = _(this.analyticsStatuses)
						.values()
						.groupBy(p => _.identity(p))
						.keys()
						.value();
		return statuses.length === 1 && _.first(statuses) === AnalyticsStatus.disabled.toString();
	}

	private initAnalyticsStatuses(): IFuture<void> {
		return (() => {
			if(this.$analyticsSettingsService.canDoRequest().wait()) {
				if(!this.isAnalyticsStatusesInitialized) {
					this.$logger.trace("Initializing analytics statuses.");
					let settingsNames = [this.$staticConfig.TRACK_FEATURE_USAGE_SETTING_NAME, this.$staticConfig.ERROR_REPORT_SETTING_NAME];
					settingsNames.forEach(settingName => this.getStatus(settingName).wait());
					this.isAnalyticsStatusesInitialized = true;
				}
				this.$logger.trace("Analytics statuses: ");
				this.$logger.trace(this.analyticsStatuses);
			}
		}).future<void>()();
	}
}
$injector.register("analyticsService", AnalyticsService);

export enum AnalyticsStatus {
	enabled,
	disabled,
	notConfirmed
}
