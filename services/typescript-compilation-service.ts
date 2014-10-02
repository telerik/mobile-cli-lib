///<reference path="../../.d.ts"/>
"use strict";

import path = require("path");
import util = require("util");
import temp = require("temp");
temp.track();

export class TypeScriptCompilationService implements ITypeScriptCompilationService {
	private typeScriptFiles: string[];

	constructor(private $childProcess: IChildProcess,
		private $fs: IFileSystem,
		private $errors: IErrors,
		private $logger: ILogger,
		private $config: IConfiguration) { }

	public initialize(typeScriptFiles: string[]): void {
		this.typeScriptFiles = typeScriptFiles;
	}

	public compileAllFiles(): IFuture<void> {
		return (() => {
			if(this.typeScriptFiles.length > 0) {
				// Create typeScript command file
				var typeScriptCommandsFilePath = path.join(temp.mkdirSync("typeScript-compilation"), "tscommand.txt");
				var typeScriptCompilerOptions = this.getTypeScriptCompilerOptions().wait();
				this.$fs.writeFile(typeScriptCommandsFilePath, this.typeScriptFiles.concat(typeScriptCompilerOptions).join(' ')).wait();

				// Get the path to tsc
				var typeScriptModuleFilePath = require.resolve("typescript");
				var typeScriptModuleDirPath = path.dirname(typeScriptModuleFilePath);
				var typeScriptCompilerPath = path.join(typeScriptModuleDirPath, "tsc");
				var typeScriptCompilerVersion = this.$fs.readJson(path.join(typeScriptModuleDirPath, "../", "package.json")).wait().version;

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
			var startTime = new Date().getTime();

			var output = this.$childProcess.spawnFromEvent("node", [typeScriptCompilerPath, "@" + typeScriptCommandsFilePath], "close", { throwError: false }).wait();
			if (output.exitCode === 0) {
				var endTime = new Date().getTime();
				var time = (endTime - startTime) / 1000;

				this.$logger.out(util.format("\n Success: %ss for %s typeScript files \n Done without errors.", time.toFixed(2), this.typeScriptFiles.length).green);
			} else {
				this.$logger.out(output.stdout);
				this.$errors.fail("Compilation failed".red);
			}
		}).future<void>()();
	}

	private getTypeScriptCompilerOptions(): IFuture<string[]> {
		return (() => {
			var compilerOptions: string[] = [];
			var options = this.$config.TYPESCRIPT_COMPILER_OPTIONS;

			// string options
			if(options.targetVersion) {
				compilerOptions.push(options.targetVersion.toUpperCase());
			}
			if(options.module) {
				compilerOptions.push(options.module.toLowerCase());
			}

			// Boolean options
			if(options.declaration) {
				compilerOptions.push("--declaration");
			}
			if(options.noImplicitAny) {
				compilerOptions.push("--noImplicitAny");
			}
			if(options.sourceMap) {
				compilerOptions.push("--sourcemap");
			}
			if(options.removeComments) {
				compilerOptions.push("--removeComments");
			}

			// Target options - TODO: read this options from .abproject file
			if(options.out) {
				compilerOptions.push("--out", options.out);
			}
			if(options.outDir) {
				if(options.out) {
					this.$logger.warn("WARNING: Option out and outDir should not be used together".magenta);
				}
				compilerOptions.push("--outDir", options.outDir);
			}
			if (options.sourceRoot) {
				compilerOptions.push('--sourceRoot', options.sourceRoot);
			}
			if (options.mapRoot) {
				compilerOptions.push('--mapRoot', options.mapRoot);
			}

			return compilerOptions;

		}).future<string[]>()();
	}
}
$injector.register("typeScriptCompilationService", TypeScriptCompilationService);
