///<reference path="../../.d.ts"/>
"use strict";

class AnalyticsCommand implements ICommand {
	constructor(private $analyticsService: IAnalyticsService,
		private $logger: ILogger,
		private $errors: IErrors,
		private $options: IOptions,
		private $staticConfig: IStaticConfig,
		private settingName: string,
		private humanReadableSettingName: string) { }

	public allowedParameters = [new AnalyticsCommandParameter(this.$errors)];
	public disableAnalyticsConsentCheck = true;

	public execute(args: string[]): IFuture<void> {
		return(() => {
			let arg = args[0] || "";
			switch(arg.toLowerCase()) {
				case "enable":
					this.$analyticsService.setStatus(this.settingName, true).wait();
					this.$logger.info(`${this.humanReadableSettingName} is now enabled.`);
					break;
				case "disable":
					this.$analyticsService.setStatus(this.settingName, false).wait();
					this.$logger.info(`${this.humanReadableSettingName} is now disabled.`);
					break;
				case "status":
				case "":
					this.$logger.out(this.$analyticsService.getStatusMessage(this.settingName, this.$options.json, this.humanReadableSettingName).wait());
					break;
			}
		}).future<void>()();
	}
}

export class UsageReportingCommand extends AnalyticsCommand {
	constructor($analyticsService: IAnalyticsService,
		 $logger: ILogger,
		 $errors: IErrors,
		 $options: IOptions,
		 $staticConfig: IStaticConfig) {
			super($analyticsService, $logger, $errors, $options, $staticConfig, $staticConfig.TRACK_FEATURE_USAGE_SETTING_NAME, "Usage reporting");
		}
}
$injector.registerCommand("usage-reporting", UsageReportingCommand);

export class ErrorReportingCommand extends AnalyticsCommand {
	constructor($analyticsService: IAnalyticsService,
		 $logger: ILogger,
		 $errors: IErrors,
		 $options: IOptions,
		 $staticConfig: IStaticConfig) {
			super($analyticsService, $logger, $errors, $options, $staticConfig, $staticConfig.ERROR_REPORT_SETTING_NAME, "Error reporting");
		}
}
$injector.registerCommand("error-reporting", ErrorReportingCommand);

export class AnalyticsCommandParameter implements ICommandParameter {
	constructor(private $errors: IErrors) { }
	mandatory = false;
	validate(validationValue: string): IFuture<boolean> {
		return (() => {
			let val = validationValue || "";
			switch(val.toLowerCase()) {
				case "enable":
				case "disable":
				case "status":
				case "":
					return true;
				default:
					this.$errors.fail(`The value '${validationValue}' is not valid. Valid values are 'enable', 'disable' and 'status'.`);
			}
		}).future<boolean>()();
	}
}
