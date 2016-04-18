///<reference path="../.d.ts"/>
"use strict";

import * as helpers from "../helpers";
import * as os from "os";
import Future = require("fibers/future");
// HACK
global.XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;
global.XMLHttpRequest.prototype.withCredentials = false;
// HACK -end

export class AnalyticsService implements IAnalyticsService {
	private static MAX_WAIT_SENDING_INTERVAL = 30000; // in milliseconds
	private _eqatecMonitor: any;
	private analyticsStatuses: IDictionary<AnalyticsStatus> = {};
	private isAnalyticsStatusesInitialized = false;
	private get acceptTrackFeatureSetting(): string {
		return `Accept${this.$staticConfig.TRACK_FEATURE_USAGE_SETTING_NAME}`;
	}

	constructor(private $staticConfig: Config.IStaticConfig,
		private $logger: ILogger,
		private $errors: IErrors,
		private $prompter: IPrompter,
		private $userSettingsService: UserSettings.IUserSettingsService,
		private $analyticsSettingsService: IAnalyticsSettingsService,
		private $options: ICommonOptions,
		private $progressIndicator: IProgressIndicator) {}

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
					this.setStatus(this.$staticConfig.TRACK_FEATURE_USAGE_SETTING_NAME, trackFeatureUsage, true).wait();
					if(!trackFeatureUsage) {
						// In case user selects to disable feature tracking, disable the exceptions reporting as well.
						this.setStatus(this.$staticConfig.ERROR_REPORT_SETTING_NAME, trackFeatureUsage, true).wait();
					}
					this.restartEqatecMonitor(this.$staticConfig.ANALYTICS_FEATURE_USAGE_TRACKING_API_KEY).wait();
					this.trackFeatureCore(`${this.acceptTrackFeatureSetting}.${!!trackFeatureUsage}`).wait();

					// Stop the monitor, so correct API_KEY will be used when features are tracked.
					this.tryStopEqatecMonitor();
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

			if(this.analyticsStatuses[this.$staticConfig.TRACK_FEATURE_USAGE_SETTING_NAME] === AnalyticsStatus.enabled) {
				this.trackFeatureCore(`${featureName}.${featureValue}`).wait();
			}
		}).future<void>()();
	}

	private trackFeatureCore(featureTrackString: string): IFuture<void> {
		return (() => {
			try {
				if(this.$analyticsSettingsService.canDoRequest().wait()) {
					this.start().wait();
					if(this._eqatecMonitor) {
						this._eqatecMonitor.trackFeature(featureTrackString);
						this.waitForSending().wait();
					}
				}
			} catch(e) {
				this.$logger.trace("Analytics exception: '%s'", e.toString());
			}
		}).future<void>()();
	}

	public trackException(exception: any, message: string): IFuture<void> {
		return (() => {
			this.initAnalyticsStatuses().wait();
			this.$logger.trace(`Trying to track exception with message '${message}'.`);

			if(this.analyticsStatuses[this.$staticConfig.ERROR_REPORT_SETTING_NAME] === AnalyticsStatus.enabled
				&& this.$analyticsSettingsService.canDoRequest().wait()) {
				try {
					this.start().wait();

					if(this._eqatecMonitor) {
						this.$logger.printInfoMessageOnSameLine("Sending exception report (press Ctrl+C to stop)...");
						this._eqatecMonitor.trackException(exception, message);
						// Sending the exception might take a while.
						// As in most cases we exit immediately after exception is caught,
						// wait for tracking the exception.
						this.$progressIndicator.showProgressIndicator(this.waitForSending(), 500).wait();
					}
				} catch(e) {
					this.$logger.trace("Analytics exception: '%s'", e.toString());
				}
			}
		}).future<void>()();
	}

	public setStatus(settingName: string, enabled: boolean, doNotTrackSetting?: boolean): IFuture<void> {
		return (() => {
			this.analyticsStatuses[settingName] = enabled ? AnalyticsStatus.enabled : AnalyticsStatus.disabled;
			this.$userSettingsService.saveSetting(settingName, enabled.toString()).wait();

			if(!doNotTrackSetting) {
				this.trackFeatureCore(`${settingName}.${enabled ? "enabled" : "disabled"}`).wait();
			}

			if(this.analyticsStatuses[settingName] === AnalyticsStatus.disabled
				&& this.analyticsStatuses[settingName] === AnalyticsStatus.disabled) {
				this.tryStopEqatecMonitor();
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

	private start(analyticsProjectKey?: string): IFuture<void> {
		return (() => {
			if(this._eqatecMonitor) {
				return;
			}

			require("../vendor/EqatecMonitor.min");

			let settings = global._eqatec.createSettings(analyticsProjectKey || this.$staticConfig.ANALYTICS_API_KEY);
			settings.useHttps = false;
			settings.userAgent = this.getUserAgentString();
			settings.version = this.$staticConfig.version;
			settings.useCookies = false;
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
				let currentCount = this.$analyticsSettingsService.getUserSessionsCount().wait();
				// increment with 1 every time and persist the new value so next execution will be marked as new session
				this.$analyticsSettingsService.setUserSessionsCount(++currentCount).wait();
				this._eqatecMonitor.setStartCount(currentCount);
			} catch(e) {
				// user not logged in. don't care.
				this.$logger.trace("Error while initializing eqatecMonitor", e);
			}

			this._eqatecMonitor.start();

			// End the session on process.exit only or in case user disables both usage tracking and exceptions tracking.
			process.on("exit", this.tryStopEqatecMonitor);

			this.reportNodeVersion().wait();
		}).future<void>()();
	}

	private reportNodeVersion(): IFuture<void> {
		return (() => {
			let reportedVersion: string = process.version.slice(1).replace(/[.]/g, "_");
			this.track("NodeJSVersion", reportedVersion).wait();
		}).future<void>()();
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

	public tryStopEqatecMonitor(code?: string|number): void {
		if(this._eqatecMonitor) {
			// remove the listener for exit event and explicitly call stop of monitor
			process.removeListener("exit", this.tryStopEqatecMonitor);
			this._eqatecMonitor.stop();
			this._eqatecMonitor = null;
		}
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

	private getIsSending(): boolean {
		return this._eqatecMonitor.status().isSending;
	}

	private waitForSending(): IFuture<void> {
		let future = new Future<void>();
		let intervalTime = 1000;
		let remainingTime = AnalyticsService.MAX_WAIT_SENDING_INTERVAL;
		let interval = setInterval(() => {
			if(!this.getIsSending() || (remainingTime <= 0)) {
				clearInterval(interval);
				future.return();
			}
			remainingTime -= intervalTime;
		}, intervalTime);

		return future;
	}

	private restartEqatecMonitor(projectApiKey: string): IFuture<void> {
		return ((): void => {
			this.tryStopEqatecMonitor();
			this.start(projectApiKey).wait();
		}).future<void>()();
	}
}
$injector.register("analyticsService", AnalyticsService);

export enum AnalyticsStatus {
	enabled,
	disabled,
	notConfirmed
}
