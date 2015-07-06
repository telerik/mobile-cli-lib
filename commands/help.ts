///<reference path="../../.d.ts"/>
"use strict";

import path = require("path");
import util = require("util");
import os = require("os");
import commandParams = require("../command-params");
import Future = require("fibers/future");

export class HelpCommand implements ICommand {
	constructor(private $logger: ILogger,
		private $injector: IInjector,
		private $htmlHelpService: IHtmlHelpService,
		private $options: IOptions) { }

	public enableHooks = false;
	public disableAnalyticsConsentCheck = true;
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
				this.$logger.out(help);
			} else {
				this.$htmlHelpService.openHelpForCommandInBrowser(topic).wait();
			}
		}).future<void>()();
	}
}
$injector.registerCommand(["help", "/?"], HelpCommand);