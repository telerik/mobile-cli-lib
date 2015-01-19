///<reference path="../.d.ts"/>
"use strict";

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
		private $staticConfig: Config.IStaticConfig) { }

	public dispatchCommand(): IFuture<void> {
		return(() => {
			if (options.version) {
				this.$logger.out(this.$staticConfig.version);
				return;
			}

			var commandName = this.getCommandName();
			var commandArguments = this.getCommandArguments();
			var lastArgument: string = _.last(commandArguments);

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
		var remaining: string[] = options._;
		if (remaining.length > 0) {
			return remaining[0].toLowerCase();
		}
		return "help";
	}

	// yargs convert parameters that are numbers to numbers, which we do not expect. undo its hard work.
	private getCommandArguments(): string[] {
		var remaining: string[] = options._;
		if (remaining.length > 1) {
			remaining = remaining.slice(1);
			remaining.forEach((item, idx, array) => {
					if (typeof item === "number") {
						array[idx] = item.toString();
					}
			});
			return remaining;
		}
		return [];
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
			var action = this.actions.dequeue().wait();
			action().wait();
		}
	}

	public dispatch(action: () => IFuture<void>) {
		this.actions.enqueue(action);
	}

	public runMainFiber(): void {
		var fiber = Fiber(() => {
			var commandDispatcher : ICommandDispatcher = $injector.resolve("commandDispatcher");

			if (process.argv[2] === "completion") {
				commandDispatcher.completeCommand().wait();
			} else {
				commandDispatcher.dispatchCommand().wait();
			}

			$injector.dispose();
			Future.assertNoFutureLeftBehind();
		});

		fiber.run();
    }
}
$injector.register("dispatcher", FutureDispatcher, false);
