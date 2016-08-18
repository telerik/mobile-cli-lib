import * as path from "path";
import * as os from "os";
import * as constants from "../../constants";
import { fromWindowsRelativePathToUnix } from "../../helpers";
import { exportedPromise } from "../../decorators";

export class NpmService implements INpmService {
	private static NPM_MODULE_NAME = "npm";
	private static TYPES_DIRECTORY = "@types/";
	private static TNS_CORE_MODULES_DEFINITION_FILE_NAME = `${constants.TNS_CORE_MODULES}${constants.FileExtensions.TYPESCRIPT_DEFINITION_FILE}`;
	private static NPM_REGISTRY_URL = "https://registry.npmjs.org";

	private _npmExecutableName: string;
	private _npmBinary: string;

	constructor(private $childProcess: IChildProcess,
		private $errors: IErrors,
		private $fs: IFileSystem,
		private $hostInfo: IHostInfo,
		private $httpClient: Server.IHttpClient,
		private $logger: ILogger,
		private $projectConstants: Project.IConstants) { }

	private get npmBinary(): string {
		if (!this._npmBinary) {
			try {
				require(NpmService.NPM_MODULE_NAME);
				let npmMainJsFile = require.resolve(NpmService.NPM_MODULE_NAME);
				let pathToNpmBinary = path.join(npmMainJsFile.substring(0, npmMainJsFile.lastIndexOf(constants.NODE_MODULES_DIR_NAME) + constants.NODE_MODULES_DIR_NAME.length), ".bin", this.npmExecutableName);

				if (!this.$fs.exists(pathToNpmBinary).wait()) {
					throw new Error(`The npm binary is not in ${pathToNpmBinary} as expected.`);
				}

				this._npmBinary = pathToNpmBinary;
			} catch (err) {
				this.$logger.trace(`Error while trying to get the npm binary: ${err}`);
				this._npmBinary = this.npmExecutableName;
			}
		}

		return this._npmBinary;
	}

	private get npmExecutableName(): string {
		if (!this._npmExecutableName) {
			this._npmExecutableName = "npm";

			if (this.$hostInfo.isWindows) {
				this._npmExecutableName += ".cmd";
			}
		}

		return this._npmExecutableName;
	}

	@exportedPromise("npmService")
	public install(projectDir: string, dependencyToInstall?: INpmDependency): IFuture<INpmInstallResult> {
		return (() => {
			let npmInstallResult: INpmInstallResult = {};

			if (dependencyToInstall) {
				npmInstallResult.result = {
					isInstalled: false,
					isTypesInstalled: false
				};

				try {
					this.npmInstall(projectDir, dependencyToInstall.name, dependencyToInstall.version, ["--save", "--save-exact"]).wait();
					npmInstallResult.result.isInstalled = true;
				} catch (err) {
					npmInstallResult.error = err;
				}

				if (dependencyToInstall.installTypes && npmInstallResult.result.isInstalled && this.hasTypesForDependency(dependencyToInstall.name).wait()) {
					try {
						this.installTypingsForDependency(projectDir, dependencyToInstall.name).wait();
						npmInstallResult.result.isTypesInstalled = true;
					} catch (err) {
						npmInstallResult.error = err;
					}
				}
			} else {
				try {
					this.npmPrune(projectDir).wait();
					this.npmInstall(projectDir).wait();
				} catch (err) {
					npmInstallResult.error = err;
				}
			}

			this.generateReferencesFile(projectDir).wait();

			return npmInstallResult;
		}).future<INpmInstallResult>()();
	}

	@exportedPromise("npmService")
	public uninstall(projectDir: string, dependency: string): IFuture<void> {
		return (() => {
			let packageJsonContent = this.getPackageJsonContent(projectDir).wait();

			if (packageJsonContent && packageJsonContent.dependencies && packageJsonContent.dependencies[dependency]) {
				this.npmUninstall(projectDir, dependency, ["--save"]).wait();
			}

			if (packageJsonContent && packageJsonContent.devDependencies && packageJsonContent.devDependencies[`${NpmService.TYPES_DIRECTORY}${dependency}`]) {
				this.npmUninstall(projectDir, `${NpmService.TYPES_DIRECTORY}${dependency}`, ["--save-dev"]).wait();
			}
		}).future<void>()();
	}

	public search(projectDir: string, keywords: string[], args?: string[]): IFuture<IBasicPluginInformation[]> {
		return ((): IBasicPluginInformation[] => {
			let result: IBasicPluginInformation[] = [];
			let spawnResult = this.executeNpmCommand(projectDir, args || [], keywords.join(" ")).wait();
			if (spawnResult.stderr) {
				// npm will write "npm WARN Building the local index for the first time, please be patient" to the stderr and if it is the only message on the stderr we should ignore it.
				let splitError = spawnResult.stderr.split("\n");
				if (splitError.length > 2 || splitError[0].indexOf("Building the local index for the first time") === -1) {
					this.$errors.failWithoutHelp(spawnResult.stderr);
				}
			}

			// Need to split the result only by \n because the npm result contains only \n and on Windows it will not split correctly when using EOL.
			// Sample output:
			// NAME                    DESCRIPTION             AUTHOR        DATE       VERSION  KEYWORDS
			// cordova-plugin-console  Cordova Console Plugin  =csantanapr…  2016-04-20 1.0.3    cordova console ecosystem:cordova cordova-ios
			let pluginsRows: string[] = spawnResult.stdout.split("\n");

			// Remove the table headers row.
			pluginsRows.shift();

			let npmNameGroup = "(\\S+)";
			let npmDateGroup = "(\\d+\\-\\d+\\-\\d+)\\s";
			let npmFreeTextGroup = "([^=]+)";
			let npmAuthorsGroup = "((?:=\\S+\\s?)+)\\s+";

			// Should look like this /(\S+)\s+([^=]+)((?:=\S+\s?)+)\s+(\d+\-\d+\-\d+)\s(\S+)(\s+([^=]+))?/
			let pluginRowRegExp = new RegExp(`${npmNameGroup}\\s+${npmFreeTextGroup}${npmAuthorsGroup}${npmDateGroup}${npmNameGroup}(\\s+${npmFreeTextGroup})?`);

			_.each(pluginsRows, (pluginRow: string) => {
				let matches = pluginRowRegExp.exec(pluginRow.trim());

				if (!matches || !matches[0]) {
					return;
				}

				result.push({
					name: matches[1],
					description: matches[2],
					author: matches[3],
					version: matches[5]
				});
			});

			return result;
		}).future<IBasicPluginInformation[]>()();
	}

	public getPackageJsonFromNpmRegistry(packageName: string, version?: string): IFuture<any> {
		return (() => {
			let packageJsonContent: any;
			version = version || "latest";
			try {
				let url = this.buildNpmRegistryUrl(packageName, version);
				// This call will return error with message '{}' in case there's no such package.
				let result = this.$httpClient.httpRequest(url).wait().body;
				packageJsonContent = JSON.parse(result);
			} catch (err) {
				this.$logger.trace("Error caught while checking the NPM Registry for plugin with id: %s", packageName);
				this.$logger.trace(err.message);
			}

			return packageJsonContent;
		}).future<any>()();
	}

	public isScopedDependency(dependency: string): boolean {
		let matches = dependency.match(this.scopedDependencyRegExp);

		return !!(matches && matches[0]);
	}

	public getScopedDependencyInformation(dependency: string): IScopedDependencyInformation {
		let matches = dependency.match(this.scopedDependencyRegExp);

		return {
			name: matches[1],
			version: matches[2]
		};
	}

	private hasTypesForDependency(packageName: string): IFuture<boolean> {
		return (() => {
			return !!this.getPackageJsonFromNpmRegistry(`${NpmService.TYPES_DIRECTORY}${packageName}`).wait();
		}).future<boolean>()();
	}

	private buildNpmRegistryUrl(packageName: string, version: string): string {
		return `${NpmService.NPM_REGISTRY_URL}/${packageName.replace("/", "%2F")}?version=${encodeURIComponent(version)}`;
	}

	private getPackageJsonContent(projectDir: string): IFuture<any> {
		return (() => {
			let pathToPackageJson = this.getPathToPackageJson(projectDir);

			try {
				return this.$fs.readJson(pathToPackageJson).wait();
			} catch (err) {
				if (err.code === "ENOENT") {
					this.$errors.failWithoutHelp(`Unable to find ${this.$projectConstants.PACKAGE_JSON_NAME} in ${projectDir}.`);
				}

				throw err;
			}

		}).future<any>()();
	}

	private getPathToPackageJson(projectDir: string): string {
		return path.join(projectDir, this.$projectConstants.PACKAGE_JSON_NAME);
	}

	private getPathToReferencesFile(projectDir: string): string {
		return path.join(projectDir, this.$projectConstants.REFERENCES_FILE_NAME);
	}

	private installTypingsForDependency(projectDir: string, dependency: string): IFuture<ISpawnResult> {
		return this.npmInstall(projectDir, `${NpmService.TYPES_DIRECTORY}${dependency}`, null, ["--save-dev", "--save-exact"]);
	}

	private generateReferencesFile(projectDir: string): IFuture<void> {
		return (() => {
			let packageJsonContent = this.getPackageJsonContent(projectDir).wait();

			let pathToReferenceFile = this.getPathToReferencesFile(projectDir),
				lines: string[] = [];

			if (packageJsonContent && packageJsonContent.dependencies && packageJsonContent.dependencies[constants.TNS_CORE_MODULES]) {
				let relativePathToTnsCoreModulesDts = `./${constants.NODE_MODULES_DIR_NAME}/${constants.TNS_CORE_MODULES}/${NpmService.TNS_CORE_MODULES_DEFINITION_FILE_NAME}`;

				if (this.$fs.exists(path.join(projectDir, relativePathToTnsCoreModulesDts)).wait()) {
					lines.push(this.getReferenceLine(relativePathToTnsCoreModulesDts));
				}
			}

			_(packageJsonContent.devDependencies)
				.keys()
				.each(devDependency => {
					if (this.isFromTypesRepo(devDependency)) {
						let nodeModulesDirectory = path.join(projectDir, constants.NODE_MODULES_DIR_NAME);
						let definitionFiles = this.$fs.enumerateFilesInDirectorySync(path.join(nodeModulesDirectory, devDependency),
							(file, stat) => _.endsWith(file, constants.FileExtensions.TYPESCRIPT_DEFINITION_FILE) || stat.isDirectory(), { enumerateDirectories: false });

						let defs = _.map(definitionFiles, def => this.getReferenceLine(fromWindowsRelativePathToUnix(path.relative(projectDir, def))));

						this.$logger.trace(`Adding lines for definition files: ${definitionFiles.join(", ")}`);
						lines.push(...defs);
					}
				});

			// TODO: Make sure the android17.d.ts and ios.d.ts are added.

			if (lines.length) {
				this.$logger.trace("Updating reference file with new entries...");
				this.$fs.writeFile(pathToReferenceFile, lines.join(os.EOL), "utf8").wait();
			} else {
				this.$logger.trace(`Could not find any .d.ts files for ${this.$projectConstants.REFERENCES_FILE_NAME} file. Deleting the old file.`);
				this.$fs.deleteFile(pathToReferenceFile).wait();
			}
		}).future<void>()();
	}

	private isFromTypesRepo(dependency: string): boolean {
		return !!dependency.match(/^@types\//);
	}

	private getReferenceLine(pathToReferencedFile: string): string {
		return `/// <reference path="${pathToReferencedFile}" />`;
	}

	private getNpmArguments(command: string, npmArguments: string[] = []): string[] {
		return npmArguments.concat([command]);
	}

	private npmInstall(projectDir: string, dependency?: string, version?: string, npmArguments?: string[]): IFuture<ISpawnResult> {
		return this.executeNpmCommand(projectDir, this.getNpmArguments("install", npmArguments), dependency, version);
	}

	private npmUninstall(projectDir: string, dependency?: string, npmArguments?: string[]): IFuture<ISpawnResult> {
		return this.executeNpmCommand(projectDir, this.getNpmArguments("uninstall", npmArguments), dependency, null);
	}

	private npmPrune(projectDir: string, dependency?: string, version?: string): IFuture<ISpawnResult> {
		return this.executeNpmCommand(projectDir, this.getNpmArguments("prune"), dependency, version);
	}

	private executeNpmCommand(projectDir: string, npmArguments: string[], dependency: string, version?: string): IFuture<ISpawnResult> {
		return ((): ISpawnResult => {
			if (dependency) {
				let dependencyToInstall = dependency;
				if (version) {
					dependencyToInstall += `@${version}`;
				}

				npmArguments.push(dependencyToInstall);
			}

			this.$childProcess.spawnFromEvent(this.npmBinary, npmArguments, "close", { cwd: projectDir }).wait();
		}).future<ISpawnResult>()();
	}
}
$injector.register("npmService", NpmService);
