///<reference path="../../.d.ts"/>
"use strict";

import util = require("util");
import path = require("path");
import helpers = require("../helpers");
import os = require("os");
// HACK
global.XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;
global.XMLHttpRequest.prototype.withCredentials = false;
// HACK -end

export class AnalyticsService implements IAnalyticsService {
	private excluded = ["help", "feature-usage-tracking"];
	private analyticsStatus: AnalyticsStatus = null;
	private _eqatecMonitor: any;

	constructor(private $staticConfig: Config.IStaticConfig,
		private $logger: ILogger,
		private $errors: IErrors,
		private $prompter: IPrompter,
		private $userSettingsService: UserSettings.IUserSettingsService,
		private $analyticsSettingsService: IAnalyticsSettingsService,
		private $options: IOptions) { }

	public checkConsent(featureName: string): IFuture<void> {
		return ((): void => {
			if(this.$analyticsSettingsService.canDoRequest().wait()) {

				if(this.isNotConfirmed().wait() && helpers.isInteractive() && !_.contains(this.excluded, featureName)) {
					this.$logger.out("Do you want to help us improve "
						+ this.$analyticsSettingsService.getClientName()
						+ " by automatically sending anonymous usage statistics? We will not use this information to identify or contact you."
						+ " You can read our official Privacy Policy at");
					let message = this.$analyticsSettingsService.getPrivacyPolicyLink();

					let trackFeatureUsage = this.$prompter.confirm(message, () => true).wait();
					this.setAnalyticsStatus(trackFeatureUsage).wait();
				}
			}
		}).future<void>()();
	}

	public trackFeature(featureName: string): IFuture<void> {
		return (() => {
			if(this.$analyticsSettingsService.canDoRequest().wait()) {
				try {
					this.start().wait();
					if(this._eqatecMonitor) {
						
						let category = this.$options.client ||
							(helpers.isInteractive() ? "CLI" : "Non-interactive");
						this._eqatecMonitor.trackFeature(category + "." + featureName);
					}
				} catch(e) {
					this.$logger.trace("Analytics exception: '%s'", e.toString());
				}
			}
		}).future<void>()();
	}

	public trackException(exception: any, message: string): IFuture<void> {
		return (() => {
			if(this.$analyticsSettingsService.canDoRequest().wait()) {
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

	public analyticsCommand(arg: string): IFuture<any> {
		return (() => {
			switch(arg) {
				case "enable":
					this.setAnalyticsStatus(true).wait();
					this.$logger.info("Feature usage tracking is now enabled.");
					break;
				case "disable":
					this.disableAnalytics().wait();
					this.$logger.info("Feature usage tracking is now disabled.");
					break;
				case "status":
				case undefined:
					this.$logger.out(this.getStatusMessage().wait());
					break;
				default:
					this.$errors.fail("Invalid parameter");
					break;
			}
		}).future<any>()();
	}

	public setAnalyticsStatus(enabled: boolean): IFuture<void> {
		this.analyticsStatus = enabled ? AnalyticsStatus.enabled : AnalyticsStatus.disabled;
		return this.$userSettingsService.saveSetting(this.$staticConfig.TRACK_FEATURE_USAGE_SETTING_NAME, enabled.toString());
	}

	private getAnalyticsStatus(): IFuture<AnalyticsStatus> {
		return (() => {
			if(!this.analyticsStatus) {
				let trackFeatureUsage = this.$userSettingsService.getSettingValue<string>(this.$staticConfig.TRACK_FEATURE_USAGE_SETTING_NAME).wait();

				if(trackFeatureUsage) {
					let isEnabled = helpers.toBoolean(trackFeatureUsage);
					if(isEnabled) {
						this.analyticsStatus = AnalyticsStatus.enabled;
					} else {
						this.analyticsStatus = AnalyticsStatus.disabled;
					}
				} else {
					this.analyticsStatus = AnalyticsStatus.notConfirmed;
				}
			}

			return this.analyticsStatus;
		}).future<AnalyticsStatus>()();
	}

	private start(): IFuture<void> {
		return (() => {
			if(this._eqatecMonitor || this.isDisabled().wait()) {
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

	public disableAnalytics(): IFuture<void> {
		return (() => {
			this.setAnalyticsStatus(false).wait();

			if(this._eqatecMonitor) {
				this._eqatecMonitor.stop();
			}
		}).future<void>()();
	}

	public isEnabled(): IFuture<boolean> {
		return (() => {
			let analyticsStatus = this.getAnalyticsStatus().wait();
			return analyticsStatus === AnalyticsStatus.enabled;
		}).future<boolean>()();
	}

	private isDisabled(): IFuture<boolean> {
		return (() => {
			let analyticsStatus = this.getAnalyticsStatus().wait();
			return analyticsStatus === AnalyticsStatus.disabled;
		}).future<boolean>()();
	}

	private isNotConfirmed(): IFuture<boolean> {
		return (() => {
			let analyticsStatus = this.getAnalyticsStatus().wait();
			return analyticsStatus === AnalyticsStatus.notConfirmed;
		}).future<boolean>()();
	}

	public getStatusMessage(): IFuture<string> {
		if(this.$options.json) {
			return this.getJsonStatusMessage();
		}

		return this.getHumanReadableStatusMessage();
	}

	private getHumanReadableStatusMessage(): IFuture<string> {
		return (() => {
			let status: string = null;

			if(this.isNotConfirmed().wait()) {
				status = "disabled until confirmed";
			} else {
				status = AnalyticsStatus[this.getAnalyticsStatus().wait()];
			}

			return util.format("Feature usage tracking is %s.", status);
		}).future<string>()();
	}

	private getJsonStatusMessage(): IFuture<string> {
		return (() => {
			let status = this.getAnalyticsStatus().wait();
			let enabled = status === AnalyticsStatus.notConfirmed ? null : status === AnalyticsStatus.disabled ? false : true;
			return JSON.stringify({ enabled: enabled });
		}).future<string>()();
	}
}
$injector.register("analyticsService", AnalyticsService);

enum AnalyticsStatus {
	enabled,
	disabled,
	notConfirmed
}
