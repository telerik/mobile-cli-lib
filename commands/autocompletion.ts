///<reference path="../../.d.ts"/>
"use strict";
import helpers = require("../helpers");

export class AutoCompleteCommand implements ICommand {
	constructor(private $autoCompletionService: IAutoCompletionService,
				private $logger: ILogger,
				private $prompter: IPrompter) {
	}

	public disableAnalytics = true;
	public allowedParameters: ICommandParameter[] = [];

	public execute(args: string[]): IFuture<void> {
		return (() => {
			if (helpers.isInteractive()) {
				if(this.$autoCompletionService.isAutoCompletionEnabled().wait()) {
					if(this.$autoCompletionService.isObsoleteAutoCompletionEnabled().wait()) {
						// obsolete autocompletion is enabled, update it to the new one:
						this.$autoCompletionService.enableAutoCompletion().wait();
					} else {
						this.$logger.info("Autocompletion is already enabled");
					}
				} else {
					this.$logger.out("If you are using bash or zsh, you can enable command-line completion.");
					let message = "Do you want to enable it now?";

					let autoCompetionStatus = this.$prompter.confirm(message,() => true).wait();
					if(autoCompetionStatus) {
						this.$autoCompletionService.enableAutoCompletion().wait();
					} else {
						// make sure we've removed all autocompletion code from all shell profiles
						this.$autoCompletionService.disableAutoCompletion().wait();
					}
				}
			}
		}).future<void>()();
	}
}
$injector.registerCommand("autocomplete|*default", AutoCompleteCommand);

export class DisableAutoCompleteCommand implements ICommand {
	constructor(private $autoCompletionService: IAutoCompletionService,
		private $logger: ILogger) {
	}

	public disableAnalytics = true;
	public allowedParameters: ICommandParameter[] = [];

	public execute(args: string[]): IFuture<void> {
		return (() => {
			if(this.$autoCompletionService.isAutoCompletionEnabled().wait()) {
				this.$autoCompletionService.disableAutoCompletion().wait();
			} else {
				this.$logger.info("Autocompletion is already disabled.");
			}
		}).future<void>()();
	}
}
$injector.registerCommand("autocomplete|disable", DisableAutoCompleteCommand);

export class EnableAutoCompleteCommand implements ICommand {
	constructor(private $autoCompletionService: IAutoCompletionService,
		private $logger: ILogger) { }

	public disableAnalytics = true;
	public allowedParameters: ICommandParameter[] = [];

	public execute(args: string[]): IFuture<void> {
		return (() => {
			if(this.$autoCompletionService.isAutoCompletionEnabled().wait()) {
				this.$logger.info("Autocompletion is already enabled.");
			} else {
				this.$autoCompletionService.enableAutoCompletion().wait();
			}
		}).future<void>()();
	}
}
$injector.registerCommand("autocomplete|enable", EnableAutoCompleteCommand);

export class AutoCompleteStatusCommand implements ICommand {
	constructor(private $autoCompletionService: IAutoCompletionService,
		private $logger: ILogger) { }

	public disableAnalytics = true;
	public allowedParameters: ICommandParameter[] = [];

	public execute(args: string[]): IFuture<void> {
		return (() => {
			if(this.$autoCompletionService.isAutoCompletionEnabled().wait()) {
				this.$logger.info("Autocompletion is enabled.");
			} else {
				this.$logger.info("Autocompletion is disabled.");
			}
		}).future<void>()();
	}
}
$injector.registerCommand("autocomplete|status", AutoCompleteStatusCommand);
