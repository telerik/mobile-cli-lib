///<reference path="../../.d.ts"/>
"use strict";

import util = require("util");

export class AnalyticsCommand implements ICommand {
	constructor(private $analyticsService: IAnalyticsService,
		private $logger: ILogger,
		private $errors: IErrors) { }

	execute(args: string[]): IFuture<void> {
		return(() => {
			var arg = args[0];
			switch(arg) {
				case "enable":
					this.$analyticsService.setAnalyticsStatus(true).wait();
					this.$logger.info("Feature usage tracking is now enabled.");
					break;
				case "disable":
					this.$analyticsService.disableAnalytics().wait();
					this.$logger.info("Feature usage tracking is now disabled.");
					break;
				case "status":
				case undefined:
					this.$logger.out(this.$analyticsService.getStatusMessage().wait());
					break;
				default:
					this.$errors.fail(util.format("The value '%s' is not valid. Valid values are 'enable', 'disable' and 'status'.", arg));
			}
		}).future<void>()();
	}

	allowedParameters = [new AnalyticsCommandParameter(this.$errors)];
}
$injector.registerCommand("feature-usage-tracking", AnalyticsCommand);

export class AnalyticsCommandParameter implements ICommandParameter {
	constructor(private $errors: IErrors) { }
	mandatory = false;
	validate(validationValue: string): IFuture<boolean> {
		return (() => {
			switch(validationValue) {
				case "enable":
				case "disable":
				case "status":
				case undefined:
					return true;
				default:
					this.$errors.fail(util.format("The value '%s' is not valid. Valid values are 'enable', 'disable' and 'status'.", validationValue));
			}
		}).future<boolean>()();
	}
}
