///<reference path="../.d.ts"/>
"use strict";

import Future = require("fibers/future");

export class HelpCommand implements ICommand {
	constructor(private $logger: ILogger,
		private $injector: IInjector,
		private $htmlHelpService: IHtmlHelpService,
		private $options: ICommonOptions) { }

	public enableHooks = false;
	public canExecute(args: string[]): IFuture<boolean> {
		return Future.fromResult(true);
	}

	public allowedParameters: ICommandParameter[] = [];

	public execute(args: string[]): IFuture<void> {
		return (() => {
			let topic = (args[0] || "").toLowerCase();
			let hierarchicalCommand = this.$injector.buildHierarchicalCommand(args[0], _.rest(args));
			if(hierarchicalCommand) {
				topic = hierarchicalCommand.commandName;
			}

			if(this.$options.help) {
				let help = this.$htmlHelpService.getCommandLineHelpForCommand(topic).wait();
				this.$logger.printMarkdown(help);
			} else {
				this.$htmlHelpService.openHelpForCommandInBrowser(topic).wait();
			}
		}).future<void>()();
	}
}
$injector.registerCommand(["help", "/?"], HelpCommand);
