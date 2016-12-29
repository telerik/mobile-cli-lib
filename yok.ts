import * as path from "path";
import {annotate, isFuture} from "./helpers";

let indent = "";
function trace(formatStr: string, ...args: any[]) {
	// uncomment following lines when debugging dependency injection
	// var args = [];
	// for (var _i = 1; _i < arguments.length; _i++) {
	// 	args[_i - 1] = arguments[_i];
	// }
	// var util = require("util");
	// console.log(util.format.apply(util, [indent + formatStr].concat(args)));
}

function pushIndent() {
	indent += "  ";
}

function popIndent() {
	indent = indent.slice(0, -2);
}

function forEachName(names: any, action: (name: string) => void): void {
	if (_.isString(names)) {
		action(names);
	} else {
		names.forEach(action);
	}
}

export function register(...rest: any[]) {
	return function (target: any): void {
		// TODO: Check if 'rest' has more arguments that have to be registered
		$injector.register(rest[0], target);
	};
}

export interface IDependency {
	require?: string;
	resolver?: () => any;
	instance?: any;
	shared?: boolean;
}

export class Yok implements IInjector {
	constructor() {
		this.register("injector", this);
	}

	private COMMANDS_NAMESPACE: string = "commands";
	private modules: {
		[name: string]: IDependency;
	} = {};

	private resolutionProgress: any = {};
	private hierarchicalCommands: IDictionary<string[]> = {};

	public requireCommand(names: any, file: string) {
		forEachName(names, (commandName) => {
			let commands = commandName.split("|");

			if (commands.length > 1) {
				if (_.startsWith(commands[1], '*') && this.modules[this.createCommandName(commands[0])]) {
					throw new Error("Default commands should be required before child commands");
				}

				let parentCommandName = commands[0];

				if (!this.hierarchicalCommands[parentCommandName]) {
					this.hierarchicalCommands[parentCommandName] = [];
				}

				this.hierarchicalCommands[parentCommandName].push(_.tail(commands).join("|"));
			}

			if (commands.length > 1 && !this.modules[this.createCommandName(commands[0])]) {
				this.require(this.createCommandName(commands[0]), file);
				if (commands[1] && !commandName.match(/\|\*/)) {
					this.require(this.createCommandName(commandName), file);
				}
			} else {
				this.require(this.createCommandName(commandName), file);
			}
		});
	}

	public require(names: any, file: string): void {
		forEachName(names, (name) => this.requireOne(name, file));
	}

	public publicApi: any = {
		__modules__: {}
	};

	public requirePublic(names: any, file: string): void {
		forEachName(names, (name) => {
			this.requireOne(name, file);
			this.resolvePublicApi(name, file);
		});
	}

	public requirePublicClass(names: any, file: string): void {
		forEachName(names, (name) => {
			this.requireOne(name, file);
			this.addClassToPublicApi(name, file);
		});
	}

	private addClassToPublicApi(name: string, file: string): void {
		Object.defineProperty(this.publicApi, name, {
			get: () => {
				return this.tryCallInitializeMethod(name);
			}
		});
	}

	private resolvePublicApi(name: string, file: string): void {
		Object.defineProperty(this.publicApi, name, {
			get: () => {
				this.tryCallInitializeMethod(name);
				return this.publicApi.__modules__[name];
			}
		});
	}

	private tryCallInitializeMethod(name: string): any {
		let classInstance = this.modules[name].instance;
		if (!classInstance) {
			classInstance = this.resolve(name);
			await // This is in order to remove  from constructors
			// as we cannot wait without fiber.
			if (classInstance.initialize) {
				let result = classInstance.initialize.apply(classInstance);
				if (isFuture(result)) {
					let fiberBootstrap = require("./fiber-bootstrap");
					fiberBootstrap.run(() => {
						await result;
					});
				}
			}
		}

		return classInstance;
	}

	private requireOne(name: string, file: string): void {
		let relativePath = path.join("../", file);
		let dependency: IDependency = {
			require: require("fs").existsSync(path.join(__dirname, relativePath + ".js")) ? relativePath : file,
			shared: true
		};

		if (!this.modules[name]) {
			this.modules[name] = dependency;
		} else {
			throw new Error(`module '${name}' require'd twice.`);
		}
	}

	public registerCommand(names: any, resolver: any): void {
		forEachName(names, (name) => {
			let commands = name.split("|");
			this.register(this.createCommandName(name), resolver);

			if (commands.length > 1) {
				this.createHierarchicalCommand(commands[0]);
			}
		});
	}

	private getDefaultCommand(name: string) {
		let subCommands = this.hierarchicalCommands[name];
		let defaultCommand = _.find(subCommands, (command) => _.startsWith(command, "*"));
		return defaultCommand;
	}

	public buildHierarchicalCommand(parentCommandName: string, commandLineArguments: string[]): any {
		let currentSubCommandName: string, finalSubCommandName: string, matchingSubCommandName: string;
		let subCommands = this.hierarchicalCommands[parentCommandName];
		let remainingArguments = commandLineArguments;
		let finalRemainingArguments = commandLineArguments;
		let foundSubCommand = false;
		_.each(commandLineArguments, arg => {
			arg = arg.toLowerCase();
			currentSubCommandName = currentSubCommandName ? this.getHierarchicalCommandName(currentSubCommandName, arg) : arg;
			remainingArguments = _.tail(remainingArguments);
			if (matchingSubCommandName = _.find(subCommands, (sc) => sc === currentSubCommandName || sc === "*" + currentSubCommandName)) {
				finalSubCommandName = matchingSubCommandName;
				finalRemainingArguments = remainingArguments;
				foundSubCommand = true;
			}
		});

		if (foundSubCommand) {
			return { commandName: this.getHierarchicalCommandName(parentCommandName, finalSubCommandName), remainingArguments: finalRemainingArguments };
		}

		return undefined;
	}

	private createHierarchicalCommand(name: string) {
		let factory = () => {
			return {
				execute: (args: string[]): IFuture<void> => {
					return (() => {
						let commandsService = $injector.resolve("commandsService");
						let commandName: string = null;
						let defaultCommand = this.getDefaultCommand(name);
						let commandArguments: ICommandArgument[] = [];

						if (args.length > 0) {
							let hierarchicalCommand = this.buildHierarchicalCommand(name, args);
							if (hierarchicalCommand) {
								commandName = hierarchicalCommand.commandName;
								commandArguments = hierarchicalCommand.remainingArguments;
							} else {
								commandName = defaultCommand ? this.getHierarchicalCommandName(name, defaultCommand) : "help";
								// If we'll execute the default command, but it's full name had been written by the user
								// for example "appbuilder cloud list", we have to remove the "list" option from the arguments that we'll pass to the command.
								if (_.includes(this.hierarchicalCommands[name], "*" + args[0])) {
									commandArguments = _.tail(args);
								} else {
									commandArguments = args;
								}
							}
						} else {
							//Execute only default command without arguments
							if (defaultCommand) {
								commandName = this.getHierarchicalCommandName(name, defaultCommand);
							} else {
								commandName = "help";

								// Show command-line help
								let options = this.resolve("options");
								options.help = true;
							}
						}

						commandsService.tryExecuteCommand(commandName, commandName = await == "help" ? [name] : commandArguments);
					}).future<void>()();
				}
			};
		};

		$injector.registerCommand(name, factory);
	}

	private getHierarchicalCommandName(parentCommandName: string, subCommandName: string) {
		return [parentCommandName, subCommandName].join("|");
	}

	public isValidHierarchicalCommand(commandName: string, commandArguments: string[]): boolean {
		if (_.includes(Object.keys(this.hierarchicalCommands), commandName)) {
			let defaultCommandName = this.getDefaultCommand(commandName);
			if (defaultCommandName && (!commandArguments || commandArguments.length === 0)) {
				// Will execute default command as there aren't passed arguments.
				return true;
			}

			let subCommands = this.hierarchicalCommands[commandName];
			if (subCommands) {
				let fullCommandName = this.buildHierarchicalCommand(commandName, commandArguments);
				if (!fullCommandName) {
					// The passed arguments are not one of the subCommands.
					// Check if the default command accepts arguments - if no, return false;

					let defaultCommand = this.resolveCommand(`${commandName}|${defaultCommandName}`);
					if (defaultCommand) {
						if (defaultCommand.canExecute) {
							return await defaultCommand.canExecute(commandArguments);
						}

						if (defaultCommand.allowedParameters.length > 0) {
							return true;
						}
					}

					let errors = $injector.resolve("errors");
					errors.fail("The input is not valid sub-command for '%s' command", commandName);
				}

				return true;
			}
		}

		return false;
	}

	public isDefaultCommand(commandName: string): boolean {
		return commandName.indexOf("*") > 0 && commandName.indexOf("|") > 0;
	}

	public register(name: string, resolver: any, shared?: boolean): void {
		shared = shared === undefined ? true : shared;
		trace("registered '%s'", name);

		let dependency: any = this.modules[name] || {};
		dependency.shared = shared;

		if (_.isFunction(resolver)) {
			dependency.resolver = resolver;
		} else {
			dependency.instance = resolver;
		}

		this.modules[name] = dependency;
	}

	public resolveCommand(name: string): ICommand {
		let command: ICommand;
		let commandModuleName = this.createCommandName(name);
		if (!this.modules[commandModuleName]) {
			return null;
		}
		command = this.resolve(commandModuleName);

		return command;
	}

	public resolve(param: any, ctorArguments?: IDictionary<any>): any {
		if (_.isFunction(param)) {
			return this.resolveConstructor(<Function>param, ctorArguments);
		} else {
			return this.resolveByName(<string>param, ctorArguments);
		}
	}

	/* Regex to match dynamic calls in the following format:
		#{moduleName.functionName} or
		#{moduleName.functionName(param1)} or
		#{moduleName.functionName(param1, param2)} - multiple parameters separated with comma are supported
		Check dynamicCall method for sample usage of this regular expression and see how to determine the passed parameters
	*/
	public get dynamicCallRegex(): RegExp {
		return /#{([^.]+)\.([^}]+?)(\((.+)\))*}/;
	}

	public async dynamicCall(call: string, args?: any[]): Promise<any> {
			let parsed = call.match(this.dynamicCallRegex);
			let module = this.resolve(parsed[1]);
			if (!args && parsed[3]) {
				args = _.map(parsed[4].split(","), arg => arg.trim());
			}

			let data = module[parsed[2]].apply(module, args);
			if (isFuture(data)) {
				return await data;
			}
			return data;
	}

	private resolveConstructor(ctor: Function, ctorArguments?: { [key: string]: any }): any {
		annotate(ctor);

		let resolvedArgs = ctor.$inject.args.map(paramName => {
			if (ctorArguments && ctorArguments.hasOwnProperty(paramName)) {
				return ctorArguments[paramName];
			} else {
				return this.resolve(paramName);
			}
		});

		let name = ctor.$inject.name;
		if (name && name[0] === name[0].toUpperCase()) {
			return new (<any>ctor)(...resolvedArgs);
		} else {
			return ctor.apply(null, resolvedArgs);
		}
	}

	private resolveByName(name: string, ctorArguments?: IDictionary<any>): any {
		if (name[0] === "$") {
			name = name.substr(1);
		}

		if (this.resolutionProgress[name]) {
			throw new Error(`Cyclic dependency detected on dependency '${name}'`);
		}
		this.resolutionProgress[name] = true;

		trace("resolving '%s'", name);
		pushIndent();

		let dependency: IDependency;
		try {
			dependency = this.resolveDependency(name);

			if (!dependency) {
				throw new Error("unable to resolve " + name);
			}

			if (!dependency.instance || !dependency.shared) {
				if (!dependency.resolver) {
					throw new Error("no resolver registered for " + name);
				}

				dependency.instance = this.resolveConstructor(dependency.resolver, ctorArguments);
			}
		}
		finally {
			popIndent();
			delete this.resolutionProgress[name];
		}

		return dependency.instance;
	}

	private resolveDependency(name: string): IDependency {
		let module = this.modules[name];
		if (!module) {
			throw new Error("unable to resolve " + name);
		}

		if (module.require) {
			require(module.require);
		}
		return module;
	}

	public getRegisteredCommandsNames(includeDev: boolean): string[] {
		let modulesNames: string[] = _.keys(this.modules);
		let commandsNames: string[] = _.filter(modulesNames, moduleName => _.startsWith(moduleName, `${this.COMMANDS_NAMESPACE}.`));
		let commands = _.map(commandsNames, (commandName: string) => commandName.substr(this.COMMANDS_NAMESPACE.length + 1));
		if (!includeDev) {
			commands = _.reject(commands, (command) => _.startsWith(command, "dev-"));
		}
		return commands;
	}

	public getChildrenCommandsNames(commandName: string): string[] {
		return this.hierarchicalCommands[commandName];
	}

	private createCommandName(name: string) {
		return `${this.COMMANDS_NAMESPACE}.${name}`;
	}

	public dispose(): void {
		Object.keys(this.modules).forEach((moduleName) => {
			let instance = this.modules[moduleName].instance;
			if (instance && instance.dispose && instance !== this) {
				instance.dispose();
			}
		});
	}
}

export let injector = new Yok();
