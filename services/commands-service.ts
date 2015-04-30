///<reference path="../../.d.ts"/>
"use strict";

let jaroWinklerDistance = require("../vendor/jaro-winkler_distance");
import helpers = require("../helpers");
import util = require("util");
import os = require("os");
let options: any = require("../options");

class CommandArgumentsValidationHelper {
	constructor(public isValid: boolean, _remainingArguments: string[]) {
		this.remainingArguments = _remainingArguments.slice();
	}

	public remainingArguments: string[];
}

export class CommandsService implements ICommandsService {
	private static HIERARCHICAL_COMMANDS_DELIMITER = "|";
	private static HIERARCHICAL_COMMANDS_DEFAULT_COMMAND_DELIMITER = "|*";
	private static HOOKS_COMMANDS_DELIMITER = "-";
	private areDynamicSubcommandsRegistered = false;

	constructor(private $errors: IErrors,
		private $logger: ILogger,
		private $injector: IInjector,
		private $staticConfig: Config.IStaticConfig,
		private $hooksService: IHooksService,
		private $commandsServiceProvider: ICommandsServiceProvider,
		private $options: IOptions) {
	}

	public allCommands(opts: {includeDevCommands: boolean}): string[] {
		let commands = this.$injector.getRegisteredCommandsNames(opts.includeDevCommands);
		return _.reject(commands, (command) => _.contains(command, '|'));
	}

	public executeCommandUnchecked(commandName: string, commandArguments: string[]): IFuture<boolean> {
		return (() => {
			let command = this.$injector.resolveCommand(commandName);

			if(command) {
				if(!this.$staticConfig.disableAnalytics && !command.disableAnalytics) {
					let analyticsService = this.$injector.resolve("analyticsService"); // This should be resolved here due to cyclic dependency
					analyticsService.checkConsent(commandName).wait();
					analyticsService.trackFeature(commandName).wait();
				}
				if(!this.$staticConfig.disableHooks && (command.enableHooks === undefined || command.enableHooks === true)) {
					// Handle correctly hierarchical commands
					let hierarchicalCommandName = this.$injector.buildHierarchicalCommand(commandName, commandArguments);
					if(hierarchicalCommandName) {
						commandName = helpers.stringReplaceAll(hierarchicalCommandName.commandName, CommandsService.HIERARCHICAL_COMMANDS_DEFAULT_COMMAND_DELIMITER, CommandsService.HOOKS_COMMANDS_DELIMITER);
						commandName = helpers.stringReplaceAll(commandName, CommandsService.HIERARCHICAL_COMMANDS_DELIMITER, CommandsService.HOOKS_COMMANDS_DELIMITER); 
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

	private printHelp(commandName: string): IFuture<boolean> {
		options.help = true;
		return this.executeCommandUnchecked("help", [this.beautifyCommandName(commandName)]);
	}

	private executeCommandAction(commandName: string, commandArguments: string[], action: (commandName: string, commandArguments: string[]) => IFuture<boolean>): IFuture<boolean> {
		return this.$errors.beginCommand(
			() => action.apply(this, [commandName, commandArguments]),
			() => this.printHelp(commandName));
	}

	public tryExecuteCommand(commandName: string, commandArguments: string[]): IFuture<void> {
		return (() => {
			var  x = (commandName: string, commandArguments: string[]) => {
				this.$options.validateOptions();
				
				if(!this.areDynamicSubcommandsRegistered) {
					this.$commandsServiceProvider.registerDynamicSubCommands();
					this.areDynamicSubcommandsRegistered = true;
				}
				return this.canExecuteCommand(commandName, commandArguments);
			}
			if(this.executeCommandAction(commandName, commandArguments, x).wait()) {
				this.executeCommandAction(commandName, commandArguments, this.executeCommandUnchecked).wait();
			} else {
				// If canExecuteCommand returns false, the command cannot be executed or there's no such command at all.
				let command = this.$injector.resolveCommand(commandName);
				if(command) {
					// If command cannot be executed we should print its help.
					this.printHelp(commandName).wait();
				}
			}
		}).future<void>()();
	}

	private canExecuteCommand(commandName: string, commandArguments: string[], isDynamicCommand?: boolean): IFuture<boolean> {
		return (() => {
			
			let command = this.$injector.resolveCommand(commandName);
			let beautifiedName = helpers.stringReplaceAll(commandName, "|", " ");
			if(command) {
				// Verify command is enabled
				if (command.isDisabled) {
					this.$errors.failWithoutHelp("This command is not applicable to your environment.");
				}

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

				this.$errors.fail("Unable to execute command '%s'. Use '$ %s %s --help' for help.", beautifiedName, this.$staticConfig.CLIENT_NAME.toLowerCase(), beautifiedName);
				return false;
			} else if(!isDynamicCommand && _.startsWith(commandName, this.$commandsServiceProvider.dynamicCommandsPrefix)){
				if(_.any(this.$commandsServiceProvider.getDynamicCommands().wait())) {
					this.$commandsServiceProvider.generateDynamicCommands().wait();
					return this.canExecuteCommand(commandName, commandArguments, true).wait();
				}
			}

			this.$logger.fatal("Unknown command '%s'. Use '%s help' for help.", beautifiedName, this.$staticConfig.CLIENT_NAME.toLowerCase());
			this.tryMatchCommand(commandName);

			return false;
		}).future<boolean>()();
	}

	private validateMandatoryParams(commandArguments: string[], mandatoryParams: ICommandParameter[]): IFuture<CommandArgumentsValidationHelper> {
		return (() => {
			let commandArgsHelper = new CommandArgumentsValidationHelper(true, commandArguments);

			if(mandatoryParams.length > 0) {
				// If command has more mandatory params than the passed ones, we shouldn't execute it
				if(mandatoryParams.length > commandArguments.length) {
					let customErrorMessages = _.map(mandatoryParams, mp => mp.errorMessage);
					customErrorMessages.splice(0, 0, "You need to provide all the required parameters.");
					this.$errors.fail(customErrorMessages.join(os.EOL));
				}

				// If we reach here, the commandArguments are at least as much as mandatoryParams. Now we should verify that we have each of them.
				_.each(mandatoryParams, (mandatoryParam) => {
					let argument = _.find(commandArgsHelper.remainingArguments, c => mandatoryParam.validate(c).wait());

					if(argument) {
						helpers.remove(commandArgsHelper.remainingArguments, arg => arg === argument);
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
			let mandatoryParams: ICommandParameter[] = _.filter(command.allowedParameters, (param) => param.mandatory);
			let commandArgsHelper = this.validateMandatoryParams(commandArguments, mandatoryParams).wait();
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
				let unverifiedAllowedParams = command.allowedParameters.filter((param) => !param.mandatory);

				_.each(commandArgsHelper.remainingArguments, (argument) => {
					let parameter = _.find(unverifiedAllowedParams, (c) => c.validate(argument).wait());
					if(parameter) {
						let index = unverifiedAllowedParams.indexOf(parameter);
						// Remove the matched parameter from unverifiedAllowedParams collection, so it will not be used to verify another argument.
						unverifiedAllowedParams.splice(index, 1);
					} else {
						this.$errors.fail("The parameter %s is not valid for this command.", argument);
					}
				});
			}

			return true;
		}).future<boolean>()();
	}

	private tryMatchCommand(commandName: string): void {
		let allCommands = this.allCommands({includeDevCommands: false});
		let similarCommands: ISimilarCommand[] = [];
		_.each(allCommands, (command) => {
			if(!this.$injector.isDefaultCommand(command)) {
				command = helpers.stringReplaceAll(command, "|", " ");
				let distance = jaroWinklerDistance(commandName, command);
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
			let message = ["Did you mean?"];
			_.each(similarCommands, (command) => {
				message.push("\t" + command.name);
			});
			this.$logger.fatal(message.join("\n"));
		}
	}

	public completeCommand(): IFuture<boolean> {
		return (() => {
			let tabtab = require("tabtab");

			let completeCallback = (err: Error, data: any) => {
				if(err || !data) {
					return;
				}

				let splittedLine = data.line.split(/[ ]+/);
				let line = _.filter(splittedLine, (w) => w !== "");
				let commandName = <string>(line[line.length - 2]);

				let childrenCommands = this.$injector.getChildrenCommandsNames(commandName);

				if(data.last && _.startsWith(data.last, "--")) {
					return tabtab.log(_.keys(options.knownOpts), data, "--");
				}

				if(data.last && _.startsWith(data.last, "-")) {
					return tabtab.log(_.keys(options.shorthands), data, "-");
				}

				if(data.words === 1) {
					let allCommands = this.allCommands({includeDevCommands: false});
					if(_.startsWith(data.last, this.$commandsServiceProvider.dynamicCommandsPrefix)) {
						allCommands = allCommands.concat(this.$commandsServiceProvider.getDynamicCommands().wait());
					}
					return tabtab.log(allCommands, data);
				}

				if(data.words >= 3) { // Hierarchical command
					commandName = util.format("%s|%s", line[1], line[2]);
				}

				let command = this.$injector.resolveCommand(commandName);
				if(command) {
					let completionData = command.completionData;
					if(completionData) {
						return tabtab.log(completionData, data)
					}
				}

				if(data.words === 2 && childrenCommands) {
					return tabtab.log(_.reject(childrenCommands, (children: string) => children[0] === '*'), data);
				}

				return false;
			};

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
