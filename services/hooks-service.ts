///<reference path="../.d.ts"/>
"use strict";

import * as path from "path";
import * as util from "util";
import Future = require("fibers/future");

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
		private $staticConfig: Config.IStaticConfig,
		private $injector: IInjector,
		private $projectHelper: IProjectHelper) { }

	private initialize(): void {
		this.cachedHooks = {};

		let relativeToLibPath = path.join(__dirname, "../../");
		this.hooksDirectories = [
			path.join(relativeToLibPath, HooksService.HOOKS_DIRECTORY_NAME),
			path.join(relativeToLibPath, "common", HooksService.HOOKS_DIRECTORY_NAME)
		];

		if(this.$projectHelper.projectDir) {
			this.hooksDirectories.push(path.join(this.$projectHelper.projectDir, HooksService.HOOKS_DIRECTORY_NAME));
		}

		this.$logger.trace("Hooks directories: " + util.inspect(this.hooksDirectories));
	}

	private static formatHookName(commandName: string): string {
		// Remove everything after | (including the pipe)
		return commandName.replace(/\|[\s\S]*$/, "");
	}

	public executeBeforeHooks(commandName: string, hookArguments?: IDictionary<any>): IFuture<void> {
		if (!this.hooksDirectories) {
			this.initialize();
		}
		let beforeHookName = `before-${HooksService.formatHookName(commandName)}`;
		this.$logger.trace("BeforeHookName for command %s is %s", commandName, beforeHookName);
		return this.executeHooks(beforeHookName, hookArguments);
	}

	public executeAfterHooks(commandName: string, hookArguments?: IDictionary<any>): IFuture<void> {
		if (!this.hooksDirectories) {
			this.initialize();
		}
		let afterHookName = `after-${HooksService.formatHookName(commandName)}`;
		this.$logger.trace("AfterHookName for command %s is %s", commandName, afterHookName);
		return this.executeHooks(afterHookName, hookArguments);
	}

	private executeHooks(hookName: string, hookArguments?: IDictionary<any>): IFuture<void> {
		return (() => {
			try {
				_.each(this.hooksDirectories, hooksDirectory => {
					this.executeHooksInDirectory(hooksDirectory, hookName, hookArguments).wait();
				});
			} catch(err) {
				this.$logger.trace("Failed during hook execution.");
				this.$errors.failWithoutHelp(err.message);
			}
		}).future<void>()();
	}

	private executeHooksInDirectory(directoryPath: string, hookName: string, hookArguments?: IDictionary<any>): IFuture<void> {
		return (() => {
			let hooks = this.getHooksByName(directoryPath, hookName).wait();
			hooks.forEach(hook => {
				this.$logger.info("Executing %s hook from %s", hookName, hook.fullPath);
				let command = this.getSheBangInterpreter(hook).wait();
				let inProc = false;
				if (!command) {
					command = hook.fullPath;
					if (path.extname(hook.fullPath).toLowerCase() === ".js") {
						command = process.argv[0];
						inProc = this.shouldExecuteInProcess(this.$fs.readText(hook.fullPath).wait());
					}
				}

				if (inProc) {
					this.$logger.trace("Executing %s hook at location %s in-process", hookName, hook.fullPath);
					let hookEntryPoint = require(hook.fullPath);
					let maybePromise = this.$injector.resolve(hookEntryPoint, hookArguments);
					if (maybePromise) {
						this.$logger.trace('Hook promises to signal completion');
						let hookCompletion = new Future<void>();
						maybePromise.then(
							() => hookCompletion.return(),
							(err: any) => {
								if (_.isBoolean(err.stopExecution) && err.errorAsWarning === true) {
									this.$logger.warn(err.message);
									hookCompletion.return();
								} else {
									hookCompletion.throw(err);
								}
							});
						hookCompletion.wait();
					}
					this.$logger.trace('Hook completed');
				} else {
					let environment = this.prepareEnvironment(hook.fullPath);
					this.$logger.trace("Executing %s hook at location %s with environment ", hookName, hook.fullPath, environment);

					let output = this.$childProcess.spawnFromEvent(command, [hook.fullPath], "close", environment, { throwError: false }).wait();
					if (output.exitCode !== 0) {
						throw new Error(output.stdout + output.stderr);
					}
				}
			});
		}).future<void>()();
	}

	private getHooksByName(directoryPath: string, hookName: string): IFuture<IHook[]> {
		return (() => {
			let allBaseHooks = this.getHooksInDirectory(directoryPath).wait();
			let baseHooks = _.filter(allBaseHooks, hook => hook.name.toLowerCase() === hookName.toLowerCase());
			let moreHooks = this.getHooksInDirectory(path.join(directoryPath, hookName)).wait();
			return baseHooks.concat(moreHooks);
		}).future<IHook[]>()();
	}

	private getHooksInDirectory(directoryPath: string): IFuture<IHook[]> {
		return (() => {
			if(!this.cachedHooks[directoryPath]) {
				let hooks: IHook[] = [];
				if(directoryPath && this.$fs.exists(directoryPath).wait() && this.$fs.getFsStats(directoryPath).wait().isDirectory()) {
					let directoryContent = this.$fs.readDirectory(directoryPath).wait();
					let files = _.filter(directoryContent, (entry: string) => {
						let fullPath = path.join(directoryPath, entry);
						let isFile = this.$fs.getFsStats(fullPath).wait().isFile();
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

		}).future<IHook[]>()();
	}

	private prepareEnvironment(hookFullPath: string): any {
		let clientName = this.$staticConfig.CLIENT_NAME.toUpperCase();

		let environment: IStringDictionary = { };
		environment[util.format("%s-COMMANDLINE", clientName)] = process.argv.join(' ');
		environment[util.format("%s-HOOK_FULL_PATH", clientName)] = hookFullPath;
		environment[util.format("%s-VERSION", clientName)] = this.$staticConfig.version;

		return {
			cwd: this.$projectHelper.projectDir,
			stdio: 'inherit',
			env:  _.extend({}, process.env, environment)
		};
	}

	private getSheBangInterpreter(hook: IHook): IFuture<string> {
		return (() => {
			let interpreter: string = null;
			let shMatch: string[] = [];
			let fileContent = this.$fs.readText(hook.fullPath).wait();
			if(fileContent) {
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
		}).future<string>()();
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
}
$injector.register("hooksService", HooksService);
