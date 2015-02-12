///<reference path="../../.d.ts"/>
"use strict";

var jaroWinklerDistance = require("../vendor/jaro-winkler_distance");
import helpers = require("../helpers");
import util = require("util");
var options: any = require("../options");

class CommandArgumentsValidationHelper {
	constructor(public isValid: boolean, public remainingArguments: string[]) { }
}

export class CommandsService implements ICommandsService {
	constructor(private $errors: IErrors,
		private $logger: ILogger,
		private $injector: IInjector,
		private $staticConfig: Config.IStaticConfig,
		private $hooksService: IHooksService) { }

	public allCommands(includeDev: boolean): string[] {
		var commands = this.$injector.getRegisteredCommandsNames(includeDev);
		return _.reject(commands, (command) => _.contains(command, '|'));
	}

	public executeCommandUnchecked(commandName: string, commandArguments: string[]): IFuture<boolean> {
		return (() => {
			var command = this.$injector.resolveCommand(commandName);
			if(command) {
				if(!command.disableAnalytics) {
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

	private executeCommandAction(commandName: string, commandArguments: string[], action: (commandName: string, commandArguments: string[]) => IFuture<boolean>): IFuture<boolean> {
		return this.$errors.beginCommand(
			() => action.apply(this, [commandName, commandArguments]),
			() => this.executeCommandUnchecked("help", [this.beautifyCommandName(commandName)]));
	}

	public tryExecuteCommand(commandName: string, commandArguments: string[]): IFuture<void> {
		return (() => {
			if(this.executeCommandAction(commandName, commandArguments, this.canExecuteCommand).wait()) {
				this.executeCommandAction(commandName, commandArguments, this.executeCommandUnchecked).wait();
			} else {
				// If canExecuteCommand returns false, the command cannot be executed or there's no such command at all.
				var command = this.$injector.resolveCommand(commandName);
				if(command) {
					// If command cannot be executed we should print its help.
					this.executeCommandUnchecked("help", [this.beautifyCommandName(commandName)]).wait();
				}
			}
		}).future<void>()();
	}

	private canExecuteCommand(commandName: string, commandArguments: string[]): IFuture<boolean> {
		return (() => {
			var command = this.$injector.resolveCommand(commandName);
			var beautifiedName = helpers.stringReplaceAll(commandName, "|", " ");

			if(command) {
				// If command wants to handle canExecute logic on its own.
				if(command.canExecute) {
					return command.canExecute(commandArguments).wait();
				}

				// First part of hierarchical commands should be validated in specific way.
				if(this.$injector.isValidHierarchicalCommand(commandName, commandArguments)) {
					return true;
				}

				if(this.validateCommandArguments(command, commandArguments).wait()) {
					return true;
				}

				this.$errors.fail("Unable to execute command '%s'. Use '$ %s %s --help' for help.", beautifiedName, this.$staticConfig.CLIENT_NAME, beautifiedName);
				return false;
			}

			this.$logger.fatal("Unknown command '%s'. Use '%s help' for help.", beautifiedName, this.$staticConfig.CLIENT_NAME);
			this.tryMatchCommand(commandName);

			return false;
		}).future<boolean>()();
	}

	private validateMandatoryParams(commandArguments: string[], mandatoryParams: ICommandParameter[]): IFuture<CommandArgumentsValidationHelper> {
		return (() => {
			var commandArgsHelper = new CommandArgumentsValidationHelper(true, commandArguments);

			if(mandatoryParams.length > 0) {
				// If command has more mandatory params than the passed ones, we shouldn't execute it
				if(mandatoryParams.length > commandArguments.length) {
                    this.$errors.fail("You need to provide all the required parameters.");
				}

				// If we reach here, the commandArguments are at least as much as mandatoryParams. Now we should verify that we have each of them.
				_.each(mandatoryParams, (mandatoryParam) => {
					var argument = _.first(_.select(commandArgsHelper.remainingArguments, (c) => mandatoryParam.validate(c).wait()))

					if(argument) {
						commandArgsHelper.remainingArguments = _.without(commandArgsHelper.remainingArguments, argument);
					}
					else {
						this.$errors.fail("Missing mandatory parameter.");
					}
				});
			}
			
			return commandArgsHelper;
		}).future<CommandArgumentsValidationHelper>()();
	}

	private validateCommandArguments(command: ICommand, commandArguments: string[]): IFuture<boolean> {
		return (() => {
			var mandatoryParams: ICommandParameter[] = _.filter(command.allowedParameters, (param) => param.mandatory);
			var commandArgsHelper = this.validateMandatoryParams(commandArguments, mandatoryParams).wait();
			if(!commandArgsHelper.isValid) {
				return false;
			}

			// Command doesn't have any allowedParameters
			if(!command.allowedParameters || command.allowedParameters.length === 0) {
				if(commandArguments.length > 0) {
					this.$errors.fail("This command doesn't accept parameters.");
				}
			} else {
				// Exclude mandatory params, we've already checked them
				var unverifiedAllowedParams = command.allowedParameters.filter((param) => !param.mandatory);

				_.each(commandArgsHelper.remainingArguments, (argument) => {
					var parameter = _.find(unverifiedAllowedParams, (c) => c.validate(argument).wait());
					if(parameter) {
						// Remove the matched parameter from unverifiedAllowedParams collection, so it will not be used to verify another argument.
						unverifiedAllowedParams = _.without(unverifiedAllowedParams, parameter);
					} else {
						this.$errors.fail("The parameter %s is not valid for this command.", argument);
					}
				});
			}

			return true;
		}).future<boolean>()();
	}

	private tryMatchCommand(commandName: string): void {
		var allCommands = this.allCommands(false);
		var similarCommands: ISimilarCommand[] = [];
		_.each(allCommands, (command) => {
			if(!this.$injector.isDefaultCommand(command)) {
				command = helpers.stringReplaceAll(command, "|", " ");
				var distance = jaroWinklerDistance(commandName, command);
				if(commandName.length > 3 && command.indexOf(commandName) != -1) {
					similarCommands.push({ rating: 1, name: command });
				} else if(distance >= 0.65) {
					similarCommands.push({ rating: distance, name: command });
				}
			}
		});

		similarCommands = _.sortBy(similarCommands, (command) => {
			return -command.rating;
		}).slice(0, 5);

		if(similarCommands.length > 0) {
			var message = ["Did you mean?"];
			_.each(similarCommands, (command) => {
				message.push("\t" + command.name);
			});
			this.$logger.fatal(message.join("\n"));
		}
	}

	public completeCommand(): IFuture<boolean> {
		return (() => {
			var completeCallback = (err: Error, data: any) => {
				if(err || !data) {
					return;
				}

				var splittedLine = data.line.split(/[ ]+/);
				var line = _.filter(splittedLine, (w) => w !== "");
				var commandName = <string>(line[line.length - 2]);

				var childrenCommands = this.$injector.getChildrenCommandsNames(commandName);

				if(data.words === 1) {
					return tabtab.log(this.allCommands(false), data);
				}

				if(data.last.startsWith("--")) {
					// Resolve optionsService here. It is not part of common lib, because we need all knownOptions for each CLI.
					var optionsService: IOptionsService = $injector.resolve("optionsService");
					return tabtab.log(optionsService.getKnownOptions(), data, "--");
				}

				if(data.words >= 3) { // Hierarchical command
					commandName = util.format("%s|%s", line[1], line[2]);
				}

				var command = this.$injector.resolveCommand(commandName);
				if(command) {
					var completionData = command.completionData;
					if(completionData) {
						return tabtab.log(completionData, data)
					}
				}

				if(data.words === 2 && childrenCommands) {
					return tabtab.log(_.reject(childrenCommands, (children: string) => children[0] === '*'), data);
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
