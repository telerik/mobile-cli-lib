///<reference path="../../.d.ts"/>
"use strict";
import helpers = require("../helpers");

export class CompletionPromptCommand implements ICommand {

	constructor(private $autoCompletionService: IAutoCompletionService,
				private $logger: ILogger,
				private $prompter: IPrompter) {
	}

	public disableAnalytics = true;
	public allowedParameters: ICommandParameter[] = [];

	public execute(args: string[]): IFuture<void> {
		return (() => {
			if (helpers.isInteractive()) {
				this.$logger.out("If you are using bash or zsh, you can enable command-line completion.");
				var message = "Do you want to enable it now?";

				var autoCompetionStatus = this.$prompter.confirm(message, () => true).wait();

				if (autoCompetionStatus) {
					this.$autoCompletionService.enableAutoCompletion().wait();
				}
			}
		}).future<void>()();
	}
}
$injector.registerCommand("autocomplete", CompletionPromptCommand);
