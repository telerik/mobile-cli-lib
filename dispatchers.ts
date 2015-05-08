///<reference path="../.d.ts"/>
"use strict";

import Fiber = require("fibers");
import Future = require("fibers/future");
import util = require("util");
import queue = require("./queue");
import path = require("path");
let options = require("./options");

export class CommandDispatcher implements ICommandDispatcher {
	constructor(private $logger: ILogger,
		private $cancellation: ICancellationService,
		private $commandsService: ICommandsService,
		private $staticConfig: Config.IStaticConfig,
		private $sysInfo: ISysInfo) { }

	public dispatchCommand(): IFuture<void> {
		return(() => {
			if (options.version) {
				this.$logger.out(this.$staticConfig.version);
				return;
			}

			if (this.$logger.getLevel() === "TRACE") {
				let sysInfo = this.$sysInfo.getSysInfo();
				this.$logger.trace("System information:");
				this.$logger.trace(sysInfo);
			}

			let commandName = this.getCommandName();
			let commandArguments = this.getCommandArguments();
			let lastArgument: string = _.last(commandArguments);

			if(options.help) {
				commandArguments.unshift(commandName);
				commandName = "help";
			} else if(lastArgument === "/?" || lastArgument === "?") {
				commandArguments.pop();
				commandArguments.unshift(commandName);
				commandName = "help";
			}

			this.$cancellation.begin("cli").wait();

			this.$commandsService.tryExecuteCommand(commandName, commandArguments).wait();
		}).future<void>()();
	}

	public completeCommand(): IFuture<boolean> {
		return this.$commandsService.completeCommand();
	}

	private getCommandName(): string {
		let remaining: string[] = options._;
		if (remaining.length > 0) {
			return remaining[0].toString().toLowerCase();
		}
		// if only <CLI_NAME> is specified on console, show console help
		options.help = true;
		return "";
	}

	// yargs convert parameters that are numbers to numbers, which we do not expect. undo its hard work.
	private getCommandArguments(): string[] {
		let remaining: string[] = options._.slice(1);
		return _.map(remaining, (item) => (typeof item === "number") ? item.toString() : item);
	}
}
$injector.register("commandDispatcher", CommandDispatcher);

class FutureDispatcher implements IFutureDispatcher {
	private actions: IQueue<any>;

	public constructor(private $errors: IErrors) { }

	public run(): void {
		if (this.actions) {
			this.$errors.fail("You cannot run a running future dispatcher.");
		}
		this.actions = new queue.Queue<any>();

		while(true) {
			let action = this.actions.dequeue().wait();
			action().wait();
		}
	}

	public dispatch(action: () => IFuture<void>) {
		this.actions.enqueue(action);
	}
}
$injector.register("dispatcher", FutureDispatcher, false);
