import * as path from "path";
import * as util from "util";
import { annotate } from "../helpers";

class Hook implements IHook {
	constructor(public name: string,
		public fullPath: string) { }
}

export class HooksService implements IHooksService {
	private static HOOKS_DIRECTORY_NAME = "hooks";

	private cachedHooks: IDictionary<IHook[]>;

	private hooksDirectories: string[];

	constructor(private $childProcess: IChildProcess,
		private $fs: IFileSystem,
		private $logger: ILogger,
		private $errors: IErrors,
		private $config: Config.IConfig,
		private $staticConfig: Config.IStaticConfig,
		private $injector: IInjector,
		private $projectHelper: IProjectHelper,
		private $options: ICommonOptions) { }

	public get hookArgsName(): string {
		return "hookArgs";
	}

	private initialize(): void {
		this.cachedHooks = {};

		let relativeToLibPath = path.join(__dirname, "../../");
		this.hooksDirectories = [
			path.join(relativeToLibPath, HooksService.HOOKS_DIRECTORY_NAME),
			path.join(relativeToLibPath, "common", HooksService.HOOKS_DIRECTORY_NAME)
		];

		if (this.$projectHelper.projectDir) {
			this.hooksDirectories.push(path.join(this.$projectHelper.projectDir, HooksService.HOOKS_DIRECTORY_NAME));
		}

		this.$logger.trace("Hooks directories: " + util.inspect(this.hooksDirectories));
	}

	private static formatHookName(commandName: string): string {
		// Remove everything after | (including the pipe)
		return commandName.replace(/\|[\s\S]*$/, "");
	}

	public executeBeforeHooks(commandName: string, hookArguments?: IDictionary<any>): Promise<void> {
		let beforeHookName = `before-${HooksService.formatHookName(commandName)}`;
		let traceMessage = `BeforeHookName for command ${commandName} is ${beforeHookName}`;
		return this.executeHooks(beforeHookName, traceMessage, hookArguments);
	}

	public executeAfterHooks(commandName: string, hookArguments?: IDictionary<any>): Promise<void> {
		let afterHookName = `after-${HooksService.formatHookName(commandName)}`;
		let traceMessage = `AfterHookName for command ${commandName} is ${afterHookName}`;
		return this.executeHooks(afterHookName, traceMessage, hookArguments);
	}

	private async executeHooks(hookName: string, traceMessage: string, hookArguments?: IDictionary<any>): Promise<void> {
		if (this.$config.DISABLE_HOOKS || !this.$options.hooks) {
			return;
		}

		if (!this.hooksDirectories) {
			this.initialize();
		}

		this.$logger.trace(traceMessage);

		try {
			for (let hooksDirectory of this.hooksDirectories) {
				await this.executeHooksInDirectory(hooksDirectory, hookName, hookArguments);
			}
		} catch (err) {
			this.$logger.trace("Failed during hook execution.");
			this.$errors.failWithoutHelp(err.message);
		}
	}

	private async executeHooksInDirectory(directoryPath: string, hookName: string, hookArguments?: IDictionary<any>): Promise<void> {
		let hooks = this.getHooksByName(directoryPath, hookName);
		for (let i = 0; i < hooks.length; ++i) {
			const hook = hooks[i];
			this.$logger.info("Executing %s hook from %s", hookName, hook.fullPath);
			let command = this.getSheBangInterpreter(hook);
			let inProc = false;
			if (!command) {
				command = hook.fullPath;
				if (path.extname(hook.fullPath).toLowerCase() === ".js") {
					command = process.argv[0];
					inProc = this.shouldExecuteInProcess(this.$fs.readText(hook.fullPath));
				}
			}

			if (inProc) {
				this.$logger.trace("Executing %s hook at location %s in-process", hookName, hook.fullPath);
				let hookEntryPoint = require(hook.fullPath);

				this.$logger.trace(`Validating ${hookName} arguments.`);

				let invalidArguments = this.validateHookArguments(hookEntryPoint);

				if (invalidArguments.length) {
					this.$logger.warn(`${hookName} will NOT be executed because it has invalid arguments - ${invalidArguments.join(", ").grey}.`);
					return;
				}

				let maybePromise = this.$injector.resolve(hookEntryPoint, hookArguments);
				if (maybePromise) {
					this.$logger.trace('Hook promises to signal completion');
					await new Promise((resolve, reject) => {
						maybePromise.then(
							resolve,
							(err: any) => {
								if (_.isBoolean(err.stopExecution) && err.errorAsWarning === true) {
									this.$logger.warn(err.message);
									resolve();
								} else {
									reject(err);
								}
							});
					});

				}
				this.$logger.trace('Hook completed');
			} else {
				let environment = this.prepareEnvironment(hook.fullPath);
				this.$logger.trace("Executing %s hook at location %s with environment ", hookName, hook.fullPath, environment);

				let output = await this.$childProcess.spawnFromEvent(command, [hook.fullPath], "close", environment, { throwError: false });
				if (output.exitCode !== 0) {
					throw new Error(output.stdout + output.stderr);
				}
			}
		};
	}

	private getHooksByName(directoryPath: string, hookName: string): IHook[] {
		let allBaseHooks = this.getHooksInDirectory(directoryPath);
		let baseHooks = _.filter(allBaseHooks, hook => hook.name.toLowerCase() === hookName.toLowerCase());
		let moreHooks = this.getHooksInDirectory(path.join(directoryPath, hookName));
		return baseHooks.concat(moreHooks);
	}

	private getHooksInDirectory(directoryPath: string): IHook[] {
		if (!this.cachedHooks[directoryPath]) {
			let hooks: IHook[] = [];
			if (directoryPath && this.$fs.exists(directoryPath) && this.$fs.getFsStats(directoryPath).isDirectory()) {
				let directoryContent = this.$fs.readDirectory(directoryPath);
				let files = _.filter(directoryContent, (entry: string) => {
					let fullPath = path.join(directoryPath, entry);
					let isFile = this.$fs.getFsStats(fullPath).isFile();
					return isFile;
				});

				hooks = _.map(files, file => {
					let fullPath = path.join(directoryPath, file);
					return new Hook(this.getBaseFilename(file), fullPath);
				});
			}

			this.cachedHooks[directoryPath] = hooks;
		}

		return this.cachedHooks[directoryPath];
	}

	private prepareEnvironment(hookFullPath: string): any {
		let clientName = this.$staticConfig.CLIENT_NAME.toUpperCase();

		let environment: IStringDictionary = {};
		environment[util.format("%s-COMMANDLINE", clientName)] = process.argv.join(' ');
		environment[util.format("%s-HOOK_FULL_PATH", clientName)] = hookFullPath;
		environment[util.format("%s-VERSION", clientName)] = this.$staticConfig.version;

		return {
			cwd: this.$projectHelper.projectDir,
			stdio: 'inherit',
			env: _.extend({}, process.env, environment)
		};
	}

	private getSheBangInterpreter(hook: IHook): string {
		let interpreter: string = null;
		let shMatch: string[] = [];
		let fileContent = this.$fs.readText(hook.fullPath);
		if (fileContent) {
			let sheBangMatch = fileContent.split('\n')[0].match(/^#!(?:\/usr\/bin\/env )?([^\r\n]+)/m);
			if (sheBangMatch) {
				interpreter = sheBangMatch[1];
			}
			if (interpreter) {
				// Likewise, make /usr/bin/bash work like "bash".
				shMatch = interpreter.match(/bin\/((?:ba)?sh)$/);
			}
			if (shMatch) {
				interpreter = shMatch[1];
			}
		}

		return interpreter;
	}

	private getBaseFilename(fileName: string): string {
		return fileName.substr(0, fileName.length - path.extname(fileName).length);
	}

	private shouldExecuteInProcess(scriptSource: string): boolean {
		try {
			let esprima = require('esprima');
			let ast = esprima.parse(scriptSource);

			let inproc = false;
			ast.body.forEach((statement: any) => {
				if (statement.type !== 'ExpressionStatement'
					|| statement.expression.type !== 'AssignmentExpression') {
					return;
				}

				let left = statement.expression.left;
				if (left.type === 'MemberExpression' &&
					left.object && left.object.type === 'Identifier' && left.object.name === 'module'
					&& left.property && left.property.type === 'Identifier' && left.property.name === 'exports') {
					inproc = true;
				}
			});

			return inproc;
		} catch (err) {
			return false;
		}
	}

	private validateHookArguments(hookConstructor: Function): string[] {
		let invalidArguments: string[] = [];

		// We need to annotate the hook in order to have the arguments of the constructor.
		annotate(hookConstructor);

		_.each(hookConstructor.$inject.args, (argument: string) => {
			try {
				if (argument !== this.hookArgsName) {
					this.$injector.resolve(argument);
				}
			} catch (err) {
				this.$logger.trace(`Cannot resolve ${argument}, reason: ${err}`);
				invalidArguments.push(argument);
			}
		});

		return invalidArguments;
	}
}
$injector.register("hooksService", HooksService);
