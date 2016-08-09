import * as path from "path";
import * as os from "os";
import temp = require("temp");
import {exportedPromise} from "../decorators";
temp.track();

interface ITypeScriptCompilerMessages {
	level1ErrorCount: number;
	level5ErrorCount: number;
	nonEmitPreventingWarningCount: number;
	hasPreventEmitErrors: boolean;
}

interface ITypeScriptCompilerSettings {
	pathToCompiler: string;
	version: string;
}

export class TypeScriptService implements ITypeScriptService {
	private static DEFAULT_TSC_VERSION = "1.8.10";
	private static TYPESCRIPT_MODULE_NAME = "typescript";

	private typeScriptFiles: string[];
	private definitionFiles: string[];
	private noEmitOnError: boolean;
	private hasInstalledTsc: boolean;

	constructor(private $childProcess: IChildProcess,
		private $fs: IFileSystem,
		private $logger: ILogger,
		private $npmService: INpmService) {
		this.hasInstalledTsc = false;
	}

	@exportedPromise("typeScriptService")
	public transpile(projectDir: string, typeScriptFiles?: string[], definitionFiles?: string[], options?: ITypeScriptTranspileOptions): IFuture<void> {
		return (() => {
			options = options || {};
			let compilerOptions = this.getCompilerOptions(projectDir, options).wait();
			this.noEmitOnError = compilerOptions.noEmitOnError;
			this.typeScriptFiles = typeScriptFiles || [];
			this.definitionFiles = definitionFiles || [];
			if (this.typeScriptFiles.length > 0) {
				// Create typeScript command file
				let typeScriptCommandsFilePath = path.join(temp.mkdirSync("typeScript-compilation"), "tscommand.txt");
				let typeScriptCompilerOptions = this.getTypeScriptCompilerOptionsAsArguments(compilerOptions);
				let typeScriptDefinitionsFiles: string[];

				if (!this.hasTsConfigFile(projectDir).wait()) {
					typeScriptDefinitionsFiles = this.getDefaultTypeScriptDefinitionsFiles(options.pathToDefaultDefinitionFiles).wait();
				}

				this.$fs.writeFile(typeScriptCommandsFilePath, this.typeScriptFiles.concat(typeScriptDefinitionsFiles).concat(typeScriptCompilerOptions).join(" ")).wait();

				let typeScriptCompilerSettings = this.getTypeScriptCompiler().wait();

				// Log some messages
				this.$logger.out("Compiling...".yellow);
				_.each(this.typeScriptFiles, file => {
					this.$logger.out(`### Compile ${file}`.cyan);
				});
				this.$logger.out(`Using tsc version ${typeScriptCompilerSettings.version}`.cyan);

				// Core compilation
				this.runTranspilation(projectDir, typeScriptCompilerSettings.pathToCompiler, { typeScriptCommandsFilePath }).wait();
			} else {
				this.transpileWithDefaultOptions(projectDir, compilerOptions).wait();
			}
		}).future<void>()();
	}

	// Uses tsconfig.json if it exists
	public transpileWithDefaultOptions(projectDir: string, options?: ITypeScriptTranspileOptions): IFuture<void> {
		return (() => {
			options = options || {};
			let compilerOptions = this.getCompilerOptions(projectDir, options).wait();
			this.noEmitOnError = compilerOptions.noEmitOnError;
			let typeScriptCompilerSettings = this.getTypeScriptCompiler().wait();
			this.$logger.out(`Using tsc version ${typeScriptCompilerSettings.version}`.cyan);

			// Core compilation
			this.runTranspilation(projectDir, typeScriptCompilerSettings.pathToCompiler, { compilerOptions }).wait();
		}).future<void>()();
	}

	public getTypeScriptFiles(projectDir: string): IFuture<ITypeScriptFiles> {
		return ((): ITypeScriptFiles => {
			// Skip root's node_modules
			let rootNodeModules = path.join(projectDir, "node_modules");
			let projectFiles = this.$fs.enumerateFilesInDirectorySync(projectDir,
				(fileName: string, fstat: IFsStats) => fileName !== rootNodeModules);
			let typeScriptFiles = _.filter(projectFiles, file => path.extname(file) === ".ts");
			let definitionFiles = _.filter(typeScriptFiles, file => _.endsWith(file, ".d.ts"));
			return { definitionFiles: definitionFiles, typeScriptFiles: typeScriptFiles };
		}).future<ITypeScriptFiles>()();
	}

	public isTypeScriptProject(projectDir: string): IFuture<boolean> {
		return ((): boolean => {
			let typeScriptFiles = this.getTypeScriptFiles(projectDir).wait();

			if (typeScriptFiles.typeScriptFiles.length > typeScriptFiles.definitionFiles.length) { // We need this check because some of non-typescript templates(for example KendoUI.Strip) contain typescript definition files
				return true;
			}

			return false;
		}).future<boolean>()();
	}

	private hasTsConfigFile(projectDir: string): IFuture<boolean> {
		return this.$fs.exists(this.getPathToTsConfigFile(projectDir));
	}

	private getPathToTsConfigFile(projectDir: string): string {
		return path.join(projectDir, "tsconfig.json");
	}

	private getCompilerOptions(projectDir: string, options: ITypeScriptTranspileOptions): IFuture<ITypeScriptCompilerOptions> {
		return ((): ITypeScriptCompilerOptions => {
			let tsConfigFile: ITypeScriptConfig;
			let pathToConfigJsonFile = this.getPathToTsConfigFile(projectDir);

			if (this.hasTsConfigFile(projectDir).wait()) {
				tsConfigFile = this.$fs.readJson(pathToConfigJsonFile).wait();
			}

			tsConfigFile = tsConfigFile || { compilerOptions: {} };
			let compilerOptions = options.compilerOptions || {};
			let defaultOptions = options.defaultCompilerOptions || {};

			let compilerOptionsKeys = _.union(_.keys(compilerOptions), _.keys(tsConfigFile.compilerOptions), _.keys(defaultOptions));

			let result: ITypeScriptCompilerOptions = {};
			_.each(compilerOptionsKeys, (key: string) => {
				// The order here is important.
				result[key] = compilerOptions[key] || tsConfigFile.compilerOptions[key] || defaultOptions[key];
			});

			result.noEmitOnError = result.noEmitOnError || false;

			return result;
		}).future<ITypeScriptCompilerOptions>()();
	}

	private getTypeScriptCompiler(): IFuture<ITypeScriptCompilerSettings> {
		return ((): ITypeScriptCompilerSettings => {
			let tempTscDirectory: string;
			if (!this.hasInstalledTsc) {
				tempTscDirectory = this.createTempDirectoryForTsc().wait();
				this.$npmService.installPlugin(`${TypeScriptService.TYPESCRIPT_MODULE_NAME}@${TypeScriptService.DEFAULT_TSC_VERSION}`, [], tempTscDirectory).wait();
				this.hasInstalledTsc = true;
			}

			// Get the path to tsc
			let typeScriptModuleFilePath = path.join(tempTscDirectory, "node_modules", TypeScriptService.TYPESCRIPT_MODULE_NAME);
			let typeScriptCompilerPath = path.join(typeScriptModuleFilePath, "lib", "tsc");
			let typeScriptCompilerVersion = this.$fs.readJson(path.join(typeScriptModuleFilePath, "package.json")).wait().version;

			return { pathToCompiler: typeScriptCompilerPath, version: typeScriptCompilerVersion };
		}).future<ITypeScriptCompilerSettings>()();
	}

	private runTranspilation(projectDir: string, typeScriptCompilerPath: string, options?: { typeScriptCommandsFilePath?: string, compilerOptions?: ITypeScriptCompilerOptions }): IFuture<void> {
		return (() => {
			options = options || {};
			let startTime = new Date().getTime();
			let params = [typeScriptCompilerPath];
			if (options.typeScriptCommandsFilePath) {
				params.push("@" + options.typeScriptCommandsFilePath);
			} else if (options.compilerOptions) {
				params = _.concat(params, this.getTypeScriptCompilerOptionsAsArguments(options.compilerOptions));
			}

			let output = this.$childProcess.spawnFromEvent(process.argv[0], params, "close", { cwd: projectDir }, { throwError: false }).wait();
			let exitcode = output.exitCode;

			// EmitReturnStatus enum in https://github.com/Microsoft/TypeScript/blob/8947757d096338532f1844d55788df87fb5a39ed/src/compiler/types.ts#L605
			if (exitcode === 0 || exitcode === 2 || exitcode === 3) {
				let endTime = new Date().getTime();
				let time = (endTime - startTime) / 1000;

				this.$logger.out(`${os.EOL}Success: ${time.toFixed(2)}s${os.EOL}Done without errors.`.green);
			} else {
				let compilerOutput = output.stderr || output.stdout;
				let compilerMessages = this.getCompilerMessages(compilerOutput);
				this.logCompilerMessages(compilerMessages, compilerOutput);
			}
		}).future<void>()();
	}

	private getCompilerMessages(compilerOutput: string): ITypeScriptCompilerMessages {
		// Assumptions:
		//   Level 1 errors = syntax errors - prevent JS emit.
		//   Level 2 errors = semantic errors - *not* prevents JS emit.
		//   Level 5 errors = compiler flag misuse - prevents JS emit.

		let level1ErrorCount = 0,
			level5ErrorCount = 0,
			nonEmitPreventingWarningCount = 0;

		let hasPreventEmitErrors = _.reduce(compilerOutput.split("\n"), (memo: any, errorMsg: string) => {
			let isPreventEmitError = !!this.noEmitOnError;
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
		};
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
				errorTitle += this.composeErrorTitle(level5ErrorCount, "compiler flag error");
			}
			if (level1ErrorCount > 0) {
				errorTitle += this.composeErrorTitle(level1ErrorCount, "syntax error");
			}
			if (nonEmitPreventingWarningCount > 0) {
				if (!level1ErrorCount && !level5ErrorCount && this.noEmitOnError) {
					errorTitle += this.composeErrorTitle(nonEmitPreventingWarningCount, "non-emit-preventing type errors, but output is not generated as noEmitOnError option is true.");
				} else {
					errorTitle += this.composeErrorTitle(nonEmitPreventingWarningCount, "non-emit-preventing type warning");
				}
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
		return `${count} ${title}${(count === 1) ? '' : 's'} ${os.EOL}`;
	}

	private getTypeScriptCompilerOptionsAsArguments(options: ITypeScriptCompilerOptions): string[] {
		this.noEmitOnError = options.noEmitOnError;
		return _(options)
			.keys()
			.map((option: string) => {
				let value: any = options[option];

				if (typeof (value) === "string") {
					return [`--${option}`, value];
				} else if (value) {
					return [`--${option}`];
				} else {
					return null;
				}
			})
			.filter(argument => !!argument)
			.flatten<string>()
			.value();
	}

	private getDefaultTypeScriptDefinitionsFiles(defaultTypeScriptDefinitionsFilesPath: string): IFuture<string[]> {
		return (() => {
			if (!this.$fs.exists(defaultTypeScriptDefinitionsFilesPath).wait()) {
				return [];
			}

			let defaultDefinitionsFiles = this.$fs.readDirectory(defaultTypeScriptDefinitionsFilesPath).wait();

			// Exclude definition files from default path, which are already part of the project (check only the name of the file)
			let remainingDefaultDefinitionFiles = _.filter(defaultDefinitionsFiles, defFile => !_.some(this.definitionFiles, f => path.basename(f) === defFile));
			return _.map(remainingDefaultDefinitionFiles, (definitionFilePath: string) => {
				return path.join(defaultTypeScriptDefinitionsFilesPath, definitionFilePath);
			}).concat(this.definitionFiles);
		}).future<string[]>()();
	}

	private createTempDirectoryForTsc(): IFuture<string> {
		return ((): string => {
			let tempDir = temp.mkdirSync(`typescript-compiler-${TypeScriptService.DEFAULT_TSC_VERSION}`);
			this.$fs.writeJson(path.join(tempDir, "package.json"), { name: "tsc-container", version: "1.0.0" }).wait();
			return tempDir;
		}).future<string>()();
	}
}

$injector.register("typeScriptService", TypeScriptService);
