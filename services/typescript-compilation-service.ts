///<reference path="../.d.ts"/>
"use strict";

import Future = require("fibers/future");
import path = require("path");
import os = require("os");
import util = require("util");
import temp = require("temp");
temp.track();

interface ITypeScriptCompilerMessages {
	level1ErrorCount: number;
	level5ErrorCount: number;
	nonEmitPreventingWarningCount: number;
	hasPreventEmitErrors: boolean;
}

export class TypeScriptCompilationService implements ITypeScriptCompilationService {
	private typeScriptFiles: string[];
	private definitionFiles: string[];

	constructor(private $childProcess: IChildProcess,
		private $fs: IFileSystem,
		private $logger: ILogger,
		private $config: Config.IConfig) { }

	public initialize(typeScriptFiles: string[], definitionFiles?: string[]): void {
		this.typeScriptFiles = typeScriptFiles;
		this.definitionFiles = definitionFiles || [];
	}

	public compileAllFiles(): IFuture<void> {
		return (() => {
			if(this.typeScriptFiles.length > 0) {
				// Create typeScript command file
				let typeScriptCommandsFilePath = path.join(temp.mkdirSync("typeScript-compilation"), "tscommand.txt");
				let typeScriptCompilerOptions = this.getTypeScriptCompilerOptions().wait();
				let typeScriptDefinitionsFiles = this.getTypeScriptDefinitionsFiles().wait();
				this.$fs.writeFile(typeScriptCommandsFilePath, this.typeScriptFiles.concat(typeScriptDefinitionsFiles).concat(typeScriptCompilerOptions).join(' ')).wait();

				// Get the path to tsc
				let typeScriptModuleFilePath = require.resolve("typescript");
				let typeScriptModuleDirPath = path.dirname(typeScriptModuleFilePath);
				let typeScriptCompilerPath = path.join(typeScriptModuleDirPath, "tsc");
				let typeScriptCompilerVersion = this.$fs.readJson(path.join(typeScriptModuleDirPath, "../", "package.json")).wait().version;

				// Log some messages
				this.$logger.out("Compiling...".yellow);
				_.each(this.typeScriptFiles, file => {
					this.$logger.out(util.format("### Compile ", file).cyan);
				});
				this.$logger.out(util.format("Using tsc version ", typeScriptCompilerVersion).cyan);

				// Core compilation
				this.runCompilation(typeScriptCompilerPath, typeScriptCommandsFilePath).wait();
			}
		}).future<void>()();
	}

	private runCompilation(typeScriptCompilerPath: string, typeScriptCommandsFilePath: string): IFuture<void> {
		return (() => {
			let startTime = new Date().getTime();

			let output = this.$childProcess.spawnFromEvent("node", [typeScriptCompilerPath, "@" + typeScriptCommandsFilePath], "close", undefined, { throwError: false }).wait();
			if (output.exitCode === 0) {
				let endTime = new Date().getTime();
				let time = (endTime - startTime) / 1000;

				this.$logger.out(util.format("\n Success: %ss for %s typeScript files \n Done without errors.", time.toFixed(2), this.typeScriptFiles.length).green);
			} else {
				let compilerOutput = output.stderr || output.stdout;
				let compilerMessages = this.getCompilerMessages(compilerOutput);
				this.logCompilerMessages(compilerMessages, compilerOutput);
			}
		}).future<void>()();
	}

	private getCompilerMessages(compilerOutput: string): ITypeScriptCompilerMessages  {
		// Assumptions:
		//   Level 1 errors = syntax errors - prevent JS emit.
		//   Level 2 errors = semantic errors - *not* prevents JS emit.
		//   Level 5 errors = compiler flag misuse - prevents JS emit.

		let level1ErrorCount = 0,
			level5ErrorCount = 0,
			nonEmitPreventingWarningCount = 0;

		let hasPreventEmitErrors = _.reduce(compilerOutput.split("\n"), (memo: any, errorMsg: string) => {
			let isPreventEmitError = false;
			if (errorMsg.search(/error TS1\d+:/) >= 0) {
				level1ErrorCount += 1;
				isPreventEmitError = true;
			} else if (errorMsg.search(/error TS5\d+:/) >= 0) {
				level5ErrorCount += 1;
				isPreventEmitError = true;
			} else if (errorMsg.search(/error TS\d+:/) >= 0) {
				nonEmitPreventingWarningCount += 1;
			}
			return memo || isPreventEmitError;
		}, false) || false;

		return {
			"level1ErrorCount": level1ErrorCount,
			"level5ErrorCount": level5ErrorCount,
			"nonEmitPreventingWarningCount": nonEmitPreventingWarningCount,
			"hasPreventEmitErrors": hasPreventEmitErrors
		}
	}

	private logCompilerMessages(compilerMessages: ITypeScriptCompilerMessages, errorMessage: string): void {
		let level1ErrorCount = compilerMessages.level1ErrorCount,
			level5ErrorCount = compilerMessages.level5ErrorCount,
			nonEmitPreventingWarningCount = compilerMessages.nonEmitPreventingWarningCount,
			hasPreventEmitErrors = compilerMessages.hasPreventEmitErrors;

		if (level1ErrorCount + level5ErrorCount + nonEmitPreventingWarningCount > 0) {
			let colorizedMessage = (level1ErrorCount + level5ErrorCount > 0) ? ">>>".red : ">>>".green;
			this.$logger.out(colorizedMessage);

			let errorTitle = "";
			if (level5ErrorCount > 0) {
				errorTitle = this.composeErrorTitle(level5ErrorCount, "compiler flag error");
			}
			if (level1ErrorCount > 0) {
				errorTitle = this.composeErrorTitle(level1ErrorCount, "syntax error");
			}
			if (nonEmitPreventingWarningCount > 0) {
				errorTitle = this.composeErrorTitle(nonEmitPreventingWarningCount, "non-emit-preventing type warning");
			}

			if (hasPreventEmitErrors) {
				process.stderr.write(os.EOL + <any>errorTitle);
				process.stderr.write(errorMessage.red + os.EOL + '>>> '.red);
				process.exit(1);
			} else {
				this.$logger.out(errorTitle);
				this.$logger.warn(errorMessage);
				this.$logger.out(('>>>').green);
			}
		}
	}

	private composeErrorTitle(count: number, title: string) {
		return util.format("%d %s%s %s", count, title, (count === 1) ? '': 's', os.EOL);
	}

	private getTypeScriptCompilerOptions(): IFuture<string[]> {
		return (() => {
			let compilerOptions: string[] = [];
			let options = this.$config.TYPESCRIPT_COMPILER_OPTIONS;

			if(options) {
				// string options
				if (options.targetVersion) {
					compilerOptions.push("--target " + options.targetVersion.toUpperCase());
				}
				if (options.module) {
					compilerOptions.push("--module " + options.module.toLowerCase());
				}

				// Boolean options
				if (options.declaration) {
					compilerOptions.push("--declaration");
				}
				if (options.noImplicitAny) {
					compilerOptions.push("--noImplicitAny");
				}
				if (options.sourceMap) {
					compilerOptions.push("--sourcemap");
				}
				if (options.removeComments) {
					compilerOptions.push("--removeComments");
				}

				if (options.out) {
					compilerOptions.push("--out ", options.out);
				}
				if (options.outDir) {
					if (options.out) {
						this.$logger.warn("WARNING: Option out and outDir should not be used together".magenta);
					}
					compilerOptions.push("--outDir ", options.outDir);
				}
				if (options.sourceRoot) {
					compilerOptions.push("--sourceRoot ", options.sourceRoot);
				}
				if (options.mapRoot) {
					compilerOptions.push("--mapRoot ", options.mapRoot);
				}
			}

			return compilerOptions;

		}).future<string[]>()();
	}

	private getTypeScriptDefinitionsFiles(): IFuture<string[]> {
		return (() => {
			let defaultTypeScriptDefinitionsFilesPath = path.join(__dirname, "../../../resources/typescript-definitions-files");
			let defaultDefinitionsFiles = this.$fs.readDirectory(defaultTypeScriptDefinitionsFilesPath).wait();

			// Exclude definition files from default path, which are already part of the project (check only the name of the file)
			let remainingDefaultDefinitionFiles = _.filter(defaultDefinitionsFiles, defFile => !_.any(this.definitionFiles, f => path.basename(f) === defFile));
			return _.map(remainingDefaultDefinitionFiles,(definitionFilePath: string) => {
				return path.join(defaultTypeScriptDefinitionsFilesPath, definitionFilePath);
			}).concat(this.definitionFiles);
		}).future<string[]>()();
	}
}
$injector.register("typeScriptCompilationService", TypeScriptCompilationService);
