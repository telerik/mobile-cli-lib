import * as path from "path";
import * as os from "os";
import temp = require("temp");
import {exportedPromise} from "../decorators";
import {NODE_MODULES_DIR_NAME, FileExtensions} from "../constants";
import { ChildProcess } from "child_process";
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
	filesToTranspile?: string[];
	compilerOptions?: ITypeScriptCompilerOptions;
}

export class TypeScriptService implements ITypeScriptService {
	private static DEFAULT_TSC_VERSION = "1.8.10";
	private static TYPESCRIPT_MODULE_NAME = "typescript";

	private typeScriptFiles: string[];
	private definitionFiles: string[];
	private noEmitOnError: boolean;
	private typeScriptModuleFilePath: string;
	private _watchProcess: ChildProcess;

	constructor(private $childProcess: IChildProcess,
		private $fs: IFileSystem,
		private $logger: ILogger,
		private $npmService: INpmService,
		private $options: ICommonOptions,
		private $projectConstants: Project.IConstants,
		private $processService: IProcessService,
		private $errors: IErrors) { }

	@exportedPromise("typeScriptService")
	public async transpile(projectDir: string, typeScriptFiles?: string[], definitionFiles?: string[], options?: ITypeScriptTranspileOptions): Promise<string> {
			options = options || {};
			let compilerOptions = this.getCompilerOptions(projectDir, options);
			let typeScriptCompilerSettings = this.getTypeScriptCompilerSettings({ useLocalTypeScriptCompiler: options.useLocalTypeScriptCompiler }).wait();
			this.noEmitOnError = compilerOptions.noEmitOnError;
			this.typeScriptFiles = typeScriptFiles || [];
			this.definitionFiles = definitionFiles || [];
			let runTranspilationOptions: IRunTranspilationOptions = { compilerOptions };

			if (this.typeScriptFiles.length > 0) {
				let typeScriptDefinitionsFiles: string[] = [];
				if (!this.hasTsConfigFile(projectDir)) {
					typeScriptDefinitionsFiles = this.getDefaultTypeScriptDefinitionsFiles(options.pathToDefaultDefinitionFiles);
				}

				typeScriptDefinitionsFiles = (await  typeScriptDefinitionsFiles.concat(this.getTypeScriptFilesData(projectDir)).definitionFiles);

				let filesToTranspile = this.typeScriptFiles.concat(typeScriptDefinitionsFiles);

				// Log some messages
				this.$logger.out("Compiling...".yellow);
				_.each(this.typeScriptFiles, file => {
					this.$logger.out(`### Compile ${file}`.cyan);
				});

				runTranspilationOptions.filesToTranspile = filesToTranspile;
			}

			this.$logger.out(`Using tsc version ${typeScriptCompilerSettings.version}`.cyan);
			// Core compilation
			return this.runTranspilation(projectDir, typeScriptCompilerSettings.pathToCompiler, runTranspilationOptions).wait();
	}

	public async getTypeScriptFilesData(projectDir: string): Promise<ITypeScriptFiles> {
			// Skip root's node_modules
			let rootNodeModules = path.join(projectDir, NODE_MODULES_DIR_NAME);
			let projectFiles = this.$fs.enumerateFilesInDirectorySync(projectDir,
				(fileName: string, fstat: IFsStats) => fileName !== rootNodeModules);
			let typeScriptFiles = _.filter(projectFiles, this.isTypeScriptFile);
			let definitionFiles = _.filter(typeScriptFiles, file => _.endsWith(file, FileExtensions.TYPESCRIPT_DEFINITION_FILE));
			return { definitionFiles: definitionFiles, typeScriptFiles: _.difference(typeScriptFiles, definitionFiles) };
	}

	public async isTypeScriptProject(projectDir: string): Promise<boolean> {
			let typeScriptFilesData = this.getTypeScriptFilesData(projectDir).wait();

			return !!typeScriptFilesData.typeScriptFiles.length;
	}

	public isTypeScriptFile(file: string): boolean {
		return path.extname(file) === FileExtensions.TYPESCRIPT_FILE;
	}

	private hasTsConfigFile(projectDir: string): boolean {
		return this.$fs.exists(this.getPathToTsConfigFile(projectDir));
	}

	private getPathToTsConfigFile(projectDir: string): string {
		return path.join(projectDir, this.$projectConstants.TSCONFIG_JSON_NAME);
	}

	private getCompilerOptions(projectDir: string, options: ITypeScriptTranspileOptions): ITypeScriptCompilerOptions {
		let tsConfigFile: ITypeScriptConfig;
		let pathToConfigJsonFile = this.getPathToTsConfigFile(projectDir);

		if (this.hasTsConfigFile(projectDir)) {
			tsConfigFile = this.$fs.readJson(pathToConfigJsonFile);
		}

		tsConfigFile = tsConfigFile || { compilerOptions: {} };
		let compilerOptions = options.compilerOptions || {};
		let defaultOptions = options.defaultCompilerOptions || {};

		let compilerOptionsKeys = _.union(_.keys(compilerOptions), _.keys(tsConfigFile.compilerOptions), _.keys(defaultOptions));

		let result: ITypeScriptCompilerOptions = {};
		_.each(compilerOptionsKeys, (key: string) => {
			result[key] = this.getCompilerOptionByKey(key, compilerOptions, tsConfigFile.compilerOptions, defaultOptions);
		});

		result.noEmitOnError = result.noEmitOnError || false;

		return result;
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

	private async getTypeScriptCompilerSettings(options: { useLocalTypeScriptCompiler: boolean }): Promise<ITypeScriptCompilerSettings> {
			let typeScriptInNodeModulesDir = path.join(NODE_MODULES_DIR_NAME, TypeScriptService.TYPESCRIPT_MODULE_NAME);
			if (!this.typeScriptModuleFilePath) {
				if (options.useLocalTypeScriptCompiler) {
					let typeScriptJsFilePath = require.resolve(TypeScriptService.TYPESCRIPT_MODULE_NAME);

					this.typeScriptModuleFilePath = typeScriptJsFilePath.substring(0, typeScriptJsFilePath.indexOf(typeScriptInNodeModulesDir) + typeScriptInNodeModulesDir.length);
				} else {
					let typeScriptModuleInstallationDir = this.createTempDirectoryForTsc();
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
			let typeScriptCompilerVersion = this.$fs.readJson(path.join(this.typeScriptModuleFilePath, this.$projectConstants.PACKAGE_JSON_NAME)).version;

			return { pathToCompiler: typeScriptCompilerPath, version: typeScriptCompilerVersion };
	}

	private async runTranspilation(projectDir: string, typeScriptCompilerPath: string, options?: IRunTranspilationOptions): Promise<string> {
			options = options || {};
			let startTime = new Date().getTime();
			let params = _([])
				.concat(typeScriptCompilerPath)
				.concat(options.filesToTranspile || [])
				.concat(this.getTypeScriptCompilerOptionsAsArguments(options.compilerOptions) || [])
				.value();

			let output = this.$childProcess.spawnFromEvent(process.argv[0], params, "close", { cwd: projectDir }, { throwError: false }).wait();
			let compilerOutput = output.stderr || output.stdout;

			// EmitReturnStatus enum in https://github.com/Microsoft/TypeScript/blob/8947757d096338532f1844d55788df87fb5a39ed/src/compiler/types.ts#L605
			let compilerMessages = this.getCompilerMessages(compilerOutput);
			// This call will fail in case noEmitOnError on error is true and there are errors.
			this.logCompilerMessages(compilerMessages, compilerOutput);

			let endTime = new Date().getTime();
			let time = (endTime - startTime) / 1000;
			this.$logger.out(`${os.EOL}Success: ${time.toFixed(2)}s${os.EOL}.`.green);

			this.startWatchProcess(params, projectDir);

			return compilerOutput;
	}

	private startWatchProcess(params: string[], projectDir: string): void {
		if (!this._watchProcess && this.$options.watch) {
			params.push("--watch");
			this._watchProcess = this.$childProcess.spawn(process.argv[0], params, { cwd: projectDir });
			this.$processService.attachToProcessExitSignals(null, this._watchProcess.kill);
		}
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

	private getDefaultTypeScriptDefinitionsFiles(defaultTypeScriptDefinitionsFilesPath: string): string[] {
		if (!this.$fs.exists(defaultTypeScriptDefinitionsFilesPath)) {
			return [];
		}

		let defaultDefinitionsFiles = this.$fs.readDirectory(defaultTypeScriptDefinitionsFilesPath);

		// Exclude definition files from default path, which are already part of the project (check only the name of the file)
		let remainingDefaultDefinitionFiles = _.filter(defaultDefinitionsFiles, defFile => !_.some(this.definitionFiles, f => path.basename(f) === defFile));
		return _.map(remainingDefaultDefinitionFiles, (definitionFilePath: string) => {
			return path.join(defaultTypeScriptDefinitionsFilesPath, definitionFilePath);
		}).concat(this.definitionFiles);
	}

	private createTempDirectoryForTsc(): string {
		let tempDir = temp.mkdirSync(`typescript-compiler-${TypeScriptService.DEFAULT_TSC_VERSION}`);
		this.$fs.writeJson(path.join(tempDir, this.$projectConstants.PACKAGE_JSON_NAME), { name: "tsc-container", version: "1.0.0" });
		return tempDir;
	}
}

$injector.register("typeScriptService", TypeScriptService);
