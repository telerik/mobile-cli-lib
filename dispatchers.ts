///<reference path="../.d.ts"/>

import Fiber = require("fibers");
import Future = require("fibers/future");
import util = require("util");
import queue = require("./queue");
import path = require("path");
var options = require("./options");

export class CommandDispatcher implements ICommandDispatcher {
	constructor(private $logger: ILogger,
		private $cancellation: ICancellationService,
		private $commandsService: ICommandsService,
		private $config) { }

	public dispatchCommand(beforeExecuteCommandHook?: (command: ICommand, commandName: string) => void): IFuture<void> {
		return(() => {
			this.$logger.setLoggerConfiguration(this.$config, options.log);

			if (options.version) {
				this.$logger.out(this.$config.version);
				return;
			}

			var commandName = this.getCommandName();
			var commandArguments = this.getCommandArguments();

			if (options.help) {
				commandArguments.unshift(commandName);
				commandName = "help";
			}

			this.$cancellation.begin("cli").wait();

			this.$commandsService.tryExecuteCommand(commandName, commandArguments, beforeExecuteCommandHook);
		}).future<void>()();
	}

	public completeCommand(propSchema?: any): void {
		this.$commandsService.completeCommand(propSchema).wait();
	}

	private getCommandName(): string {
		var remaining: string[] = options._;
		if (remaining.length > 0) {
			return remaining[0].toLowerCase();
		}
		return "help";
	}

	private getCommandArguments(): string[] {
		var remaining: string[] = options._;
		if (remaining.length > 1) {
			return remaining.slice(1);
		}
		return [];
	}
}
$injector.register("commandDispatcher", CommandDispatcher);

class FutureDispatcher implements IFutureDispatcher {
	private actions: IQueue<any>

	public constructor(private $errors: IErrors) { }

	public run(): void {
		if (this.actions) {
			this.$errors.fail("You cannot run a running future dispatcher.")
		}
		this.actions = new queue.Queue<any>();

		while(true) {
			var action = this.actions.dequeue().wait();
			action().wait();
		}
	}

	public dispatch(action: () => IFuture<void>) {
		this.actions.enqueue(action);
	}
}
$injector.register("dispatcher", FutureDispatcher, false);