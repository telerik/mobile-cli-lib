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
		private $errors: IErrors,
		private $fs: IFileSystem,
		private $staticConfig: Config.IStaticConfig,
		private $microTemplateService: IMicroTemplateService) { }

	public enableHooks = false;
	public canExecute(args: string[]): IFuture<boolean> {
		return Future.fromResult(true);
	}

	public allowedParameters: ICommandParameter[] = [];

	public execute(args: string[]): IFuture<void> {
		return (() => {
			var topic = (args[0] || "").toLowerCase();
			if (topic === "help") {
				topic = "";
			}

			var hierarchicalCommand = this.$injector.buildHierarchicalCommand(args[0], _.rest(args));
			if(hierarchicalCommand) {
				topic = hierarchicalCommand.commandName;
			}

			var helpContent = this.$fs.readText(this.$staticConfig.helpTextPath).wait();

			var pattern = util.format("--\\[%s\\]--((.|[\\r\\n])+?)--\\[/\\]--", (<any>RegExp).escape(topic));
			var regex = new RegExp(pattern);

			var match = regex.exec(helpContent);
			if (match) {
				var helpText = match[1].trim();

				var outputText = this.$microTemplateService.parseContent(helpText);
				this.$logger.out(outputText);
			} else {
				this.$errors.failWithoutHelp("Unknown help topic '%s'", topic);
			}
		}).future<void>()();
	}
}
$injector.registerCommand(["help", "/?"], HelpCommand);