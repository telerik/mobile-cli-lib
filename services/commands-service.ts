///<reference path="../../.d.ts"/>

var jaroWinklerDistance = require("../vendor/jaro-winkler_distance");
import helpers = require("./../helpers");
import util = require("util");

export class CommandsService implements ICommandsService {
	constructor(private $errors: IErrors,
		private $logger: ILogger,
		private $injector: IInjector,
		private $staticConfig: Config.IStaticConfig,
		private $hooksService: IHooksService) { }

	public allCommands(includeDev: boolean): string[]{
		var commands = this.$injector.getRegisteredCommandsNames(includeDev);
		return _.reject(commands, (command) => _.contains(command, '|'));
	}

	public executeCommandUnchecked(commandName: string, commandArguments: string[]): IFuture<boolean> {
		return (() => {
			var command = this.$injector.resolveCommand(commandName);
			if (command) {
				if (!command.disableAnalytics) {
					var analyticsService = this.$injector.resolve("analyticsService"); // This should be resolved here due to cyclic dependency
					analyticsService.checkConsent(commandName).wait();
					analyticsService.trackFeature(commandName).wait();
				}
				if(command.enableHooks === undefined || command.enableHooks === true) {
					// Handle correctly hierarchical commands
					var childrenCommandsNames = _.map(this.$injector.getChildrenCommandsNames(commandName), command => { return command.replace("*", ""); });
					if(_.contains(childrenCommandsNames, commandArguments[0])) {
						commandName = util.format("%s-%s", commandName, commandArguments[0]);
					}

					this.$hooksService.initialize(commandName);
					this.$hooksService.executeBeforeHooks().wait();
					command.execute(commandArguments).wait();
					this.$hooksService.executeAfterHooks().wait();

				} else {
					command.execute(commandArguments).wait();
				}
				return true;
			}
			return false;
		}).future<boolean>()();
	}

	public executeCommand(commandName: string, commandArguments: string[]): IFuture<boolean> {
		return this.$errors.beginCommand(
			() => this.executeCommandUnchecked(commandName, commandArguments),
			() => this.executeCommandUnchecked("help", [this.beautifyCommandName(commandName)]));
	}

	public tryExecuteCommand(commandName: string, commandArguments: string[]): IFuture<void> {
		return (() => {
			if(!this.executeCommand(commandName, commandArguments).wait()) {
				this.$logger.fatal("Unknown command '%s'. Use '%s help' for help.", helpers.stringReplaceAll(commandName, "|", " "), this.$staticConfig.CLIENT_NAME);
				this.tryMatchCommand(commandName);
			}
		}).future<void>()();
	}

	private tryMatchCommand(commandName: string): void {
		var allCommands = this.allCommands(false);
		var similarCommands: ISimilarCommand[] = [];
		_.each(allCommands, (command) => {
			if(!this.$injector.isDefaultCommand(command)) {
				command = helpers.stringReplaceAll(command, "|", " ");
				var distance = jaroWinklerDistance(commandName, command);
				if (commandName.length > 3 && command.indexOf(commandName) != -1) {
					similarCommands.push({ rating: 1, name: command });
				} else if (distance >= 0.65) {
					similarCommands.push({ rating: distance, name: command });
				}
			}
		});

		similarCommands = _.sortBy(similarCommands, (command) => {
			return -command.rating;
		}).slice(0, 5);

		if (similarCommands.length > 0) {
			var message = ["Did you mean?"];
			_.each(similarCommands, (command) => {
				message.push("\t" + command.name);
			});
			this.$logger.fatal(message.join("\n"));
		}
	}

	public completeCommand(commandsWithPlatformArgument: string[], platforms: string[], getPropSchemaAction?: any): IFuture<boolean> {
		return (() => {
			var completeCallback = (err: Error, data: any) => {
				if (err || !data) {
					return;
				}

				var childrenCommands = this.$injector.getChildrenCommandsNames(data.prev);

				if (data.words == 1) {
					return tabtab.log(this.allCommands(false), data);
				}

				if (data.last.startsWith("--")) {
					return tabtab.log(Object.keys(require("./options").knownOpts), data, "--");
				}

				if (_.contains(commandsWithPlatformArgument, data.prev)) {
					return tabtab.log(platforms, data);
				}

				if (data.words == 2 && childrenCommands) {
					return tabtab.log(_.reject(childrenCommands, (children: string) => children[0] === '*'), data);
				}

				var propSchema = getPropSchemaAction ? getPropSchemaAction() : null;

				if (propSchema) {
					var propertyCommands = ["print", "set", "add", "del"];
					var parseResult = /prop ([^ ]+) ([^ ]*)/.exec(data.line);
					if (parseResult) {
						if (_.contains(propertyCommands, parseResult[1])) {
							var propName = parseResult[2];
							if (propSchema[propName]) {
								var range = propSchema[propName].range;
								if (range) {
									if (!_.isArray(range)) {
										range = _.map(range, (value: { input: string }, key: string) => {
											return value.input || key;
										});
									}
									return tabtab.log(range, data);
								}
							} else {
								return tabtab.log(Object.keys(propSchema), data);
							}
						}
					}
				}

				return false;
			};

			var tabtab = require("tabtab");
			tabtab.complete(this.$staticConfig.CLIENT_NAME.toLowerCase(), completeCallback);

			if(this.$staticConfig.CLIENT_NAME_ALIAS) {
				tabtab.complete(this.$staticConfig.CLIENT_NAME_ALIAS.toLowerCase(), completeCallback);
			}

			return true;
		}).future<boolean>()();
	}

	private beautifyCommandName(commandName: string): string {
		if(commandName.indexOf("*") > 0) {
			return commandName.substr(0, commandName.indexOf("|"));
		}

		return commandName;
	}
}
$injector.register("commandsService", CommandsService);
