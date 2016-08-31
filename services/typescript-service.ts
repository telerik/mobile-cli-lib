import * as path from "path";
import * as os from "os";
import temp = require("temp");
import {exportedPromise} from "../decorators";
import {NODE_MODULES_DIR_NAME, FileExtensions} from "../constants";
import {quoteString} from "../helpers";
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

interface IRunTranspilationOptions {
	typeScriptCommandsFilePath?: string;
	compilerOptions?: ITypeScriptCompilerOptions;
}

export class TypeScriptService implements ITypeScriptService {
	private static DEFAULT_TSC_VERSION = "1.8.10";
	private static TYPESCRIPT_MODULE_NAME = "typescript";

	private typeScriptFiles: string[];
	private definitionFiles: string[];
	private noEmitOnError: boolean;
	private typeScriptModuleFilePath: string;

	constructor(private $childProcess: IChildProcess,
		private $fs: IFileSystem,
		private $logger: ILogger,
		private $npmService: INpmService,
		private $projectConstants: Project.IConstants,
		private $errors: IErrors) { }

	@exportedPromise("typeScriptService")
	public transpile(projectDir: string, typeScriptFiles?: string[], definitionFiles?: string[], options?: ITypeScriptTranspileOptions): IFuture<string> {
		return ((): string => {
			options = options || {};
			let compilerOptions = this.getCompilerOptions(projectDir, options).wait();
			let typeScriptCompilerSettings = this.getTypeScriptCompilerSettings({ useLocalTypeScriptCompiler: options.useLocalTypeScriptCompiler }).wait();
			this.noEmitOnError = compilerOptions.noEmitOnError;
			this.typeScriptFiles = typeScriptFiles || [];
			this.definitionFiles = definitionFiles || [];
			let runTranspilationOptions: IRunTranspilationOptions = { compilerOptions };

			if (this.typeScriptFiles.length > 0) {
				// Create typeScript command file
				let typeScriptCommandsFilePath = path.join(temp.mkdirSync("typeScript-compilation"), "tscommand.txt");
				let typeScriptCompilerOptions = this.getTypeScriptCompilerOptionsAsArguments(compilerOptions);
				let typeScriptDefinitionsFiles: string[];

				if (!this.hasTsConfigFile(projectDir).wait()) {
					typeScriptDefinitionsFiles = this.getDefaultTypeScriptDefinitionsFiles(options.pathToDefaultDefinitionFiles).wait();
				}

				// We need to add quotation marks in case some file path contains spaces in it.
				this.typeScriptFiles = this.quoteFileNames(this.typeScriptFiles);
				typeScriptDefinitionsFiles = this.quoteFileNames(typeScriptDefinitionsFiles);

				this.$fs.writeFile(typeScriptCommandsFilePath, this.typeScriptFiles.concat(typeScriptDefinitionsFiles).concat(typeScriptCompilerOptions).join(" ")).wait();

				// Log some messages
				this.$logger.out("Compiling...".yellow);
				_.each(this.typeScriptFiles, file => {
					this.$logger.out(`### Compile ${file}`.cyan);
				});

				runTranspilationOptions = { typeScriptCommandsFilePath };
			}

			this.$logger.out(`Using tsc version ${typeScriptCompilerSettings.version}`.cyan);
			// Core compilation
			return this.runTranspilation(projectDir, typeScriptCompilerSettings.pathToCompiler, runTranspilationOptions).wait();
		}).future<string>()();
	}

	public getTypeScriptFilesData(projectDir: string): IFuture<ITypeScriptFiles> {
		return ((): ITypeScriptFiles => {
			// Skip root's node_modules
			let rootNodeModules = path.join(projectDir, NODE_MODULES_DIR_NAME);
			let projectFiles = this.$fs.enumerateFilesInDirectorySync(projectDir,
				(fileName: string, fstat: IFsStats) => fileName !== rootNodeModules);
			let typeScriptFiles = _.filter(projectFiles, file => path.extname(file) === FileExtensions.TYPESCRIPT_FILE);
			let definitionFiles = _.filter(typeScriptFiles, file => _.endsWith(file, FileExtensions.TYPESCRIPT_DEFINITION_FILE));
			return { definitionFiles: definitionFiles, typeScriptFiles: _.difference(typeScriptFiles, definitionFiles) };
		}).future<ITypeScriptFiles>()();
	}

	public isTypeScriptProject(projectDir: string): IFuture<boolean> {
		return ((): boolean => {
			let typeScriptFilesData = this.getTypeScriptFilesData(projectDir).wait();

			return !!typeScriptFilesData.typeScriptFiles.length;
		}).future<boolean>()();
	}

	private hasTsConfigFile(projectDir: string): IFuture<boolean> {
		return this.$fs.exists(this.getPathToTsConfigFile(projectDir));
	}

	private getPathToTsConfigFile(projectDir: string): string {
		return path.join(projectDir, this.$projectConstants.TSCONFIG_JSON_NAME);
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
				result[key] = this.getCompilerOptionByKey(key, compilerOptions, tsConfigFile, defaultOptions);
			});

			result.noEmitOnError = result.noEmitOnError || false;

			return result;
		}).future<ITypeScriptCompilerOptions>()();
	}

	private getCompilerOptionByKey(key: string, compilerOptions: ITypeScriptCompilerOptions, tsConfigFileOptions: ITypeScriptCompilerOptions, defaultOptions: ITypeScriptCompilerOptions): any {
		// The order here is important.
		if (_.has(compilerOptions, key)) {
			return compilerOptions[key];
		}

		if (_.has(tsConfigFileOptions, key)) {
			return tsConfigFileOptions[key];
		}

		return defaultOptions[key];
	}

	private getTypeScriptCompilerSettings(options: { useLocalTypeScriptCompiler: boolean }): IFuture<ITypeScriptCompilerSettings> {
		return ((): ITypeScriptCompilerSettings => {
			let typeScriptInNodeModulesDir = path.join(NODE_MODULES_DIR_NAME, TypeScriptService.TYPESCRIPT_MODULE_NAME);
			if (!this.typeScriptModuleFilePath) {
				if (options.useLocalTypeScriptCompiler) {
					let typeScriptJsFilePath = require.resolve(TypeScriptService.TYPESCRIPT_MODULE_NAME);

					this.typeScriptModuleFilePath = typeScriptJsFilePath.substring(0, typeScriptJsFilePath.indexOf(typeScriptInNodeModulesDir) + typeScriptInNodeModulesDir.length);
				} else {
					let typeScriptModuleInstallationDir = this.createTempDirectoryForTsc().wait();
					let pluginToInstall: INpmDependency = {
						name: TypeScriptService.TYPESCRIPT_MODULE_NAME,
						version: TypeScriptService.DEFAULT_TSC_VERSION,
						installTypes: false
					};

					this.$npmService.install(typeScriptModuleInstallationDir, pluginToInstall).wait();
					this.typeScriptModuleFilePath = path.join(typeScriptModuleInstallationDir, typeScriptInNodeModulesDir);
				}
			}

			let typeScriptCompilerPath = path.join(this.typeScriptModuleFilePath, "lib", "tsc");
			let typeScriptCompilerVersion = this.$fs.readJson(path.join(this.typeScriptModuleFilePath, this.$projectConstants.PACKAGE_JSON_NAME)).wait().version;

			return { pathToCompiler: typeScriptCompilerPath, version: typeScriptCompilerVersion };
		}).future<ITypeScriptCompilerSettings>()();
	}

	private runTranspilation(projectDir: string, typeScriptCompilerPath: string, options?: IRunTranspilationOptions): IFuture<string> {
		return ((): string => {
			options = options || {};
			let startTime = new Date().getTime();
			let params = [typeScriptCompilerPath];
			if (options.typeScriptCommandsFilePath) {
				params.push("@" + options.typeScriptCommandsFilePath);
			} else if (options.compilerOptions) {
				params = _.concat(params, this.getTypeScriptCompilerOptionsAsArguments(options.compilerOptions));
			}

			let output = this.$childProcess.spawnFromEvent(process.argv[0], params, "close", { cwd: projectDir }, { throwError: false }).wait();
			let compilerOutput = output.stderr || output.stdout;

			// EmitReturnStatus enum in https://github.com/Microsoft/TypeScript/blob/8947757d096338532f1844d55788df87fb5a39ed/src/compiler/types.ts#L605
			let compilerMessages = this.getCompilerMessages(compilerOutput);
			// This call will fail in case noEmitOnError on error is true and there are errors.
			this.logCompilerMessages(compilerMessages, compilerOutput);

			let endTime = new Date().getTime();
			let time = (endTime - startTime) / 1000;
			this.$logger.out(`${os.EOL}Success: ${time.toFixed(2)}s${os.EOL}.`.green);

			return compilerOutput;
		}).future<string>()();
	}

	private getCompilerMessages(compilerOutput: string): ITypeScriptCompilerMessages {
		// Assumptions:
		//   Level 1 errors = syntax errors - prevent JS emit.
		//   Level 2 errors = semantic errors - *not* prevents JS emit.
		//   Level 5 errors = compiler flag misuse - prevents JS emit.

		let level1ErrorCount = 0,
			level5ErrorCount = 0,
			nonEmitPreventingWarningCount = 0;

		let hasPreventEmitErrors = _.reduce(compilerOutput.split("\n"), (memo: boolean, errorMsg: string) => {
			let isPreventEmitError = !!this.noEmitOnError;
			if (errorMsg.search(/error TS1\d+:/) >= 0) {
				level1ErrorCount += 1;
			} else if (errorMsg.search(/error TS5\d+:/) >= 0) {
				level5ErrorCount += 1;
			} else if (errorMsg.search(/error TS\d+:/) >= 0) {
				nonEmitPreventingWarningCount += 1;
			}
			return memo || isPreventEmitError;
		}, false) || false;

		return {
			level1ErrorCount,
			level5ErrorCount,
			nonEmitPreventingWarningCount,
			hasPreventEmitErrors
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
				this.$errors.failWithoutHelp(`${os.EOL}${errorTitle}${os.EOL}${errorMessage.red}${os.EOL}${">>> ".red}`);
			} else {
				this.$logger.out(errorTitle);
				this.$logger.warn(errorMessage);
				this.$logger.out(">>>".green);
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
			this.$fs.writeJson(path.join(tempDir, this.$projectConstants.PACKAGE_JSON_NAME), { name: "tsc-container", version: "1.0.0" }).wait();
			return tempDir;
		}).future<string>()();
	}

	private quoteFileNames(files: string[]): string[] {
		return _.map(files, (fileName: string) => quoteString(fileName));
	}
}

$injector.register("typeScriptService", TypeScriptService);
