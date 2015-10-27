interface Object {
	[key: string]: any;
}

interface IStringDictionary extends IDictionary<string> { }

declare module Server {
	interface IResponse {
		response: any;
		body?: string;
		headers: any;
		error?: Error;
	}

	interface IHttpClient {
		httpRequest(url:string): IFuture<IResponse>;
		httpRequest(options:any): IFuture<IResponse>;
	}

	interface IRequestResponseData {
		statusCode: number;
		headers: { [index: string]: any };
		pipe(destination: any, options?: { end?: boolean; }): IRequestResponseData;
		on(event: string, listener: Function): void;
	}
}

interface IDisposable {
	dispose(): void;
}

interface IFileSystem {
	zipFiles(zipFile: string, files: string[], zipPathCallback: (path: string) => string): IFuture<void>;
	unzip(zipFile: string, destinationDir: string, options?: { overwriteExisitingFiles?: boolean; caseSensitive?: boolean}, fileFilters?: string[]): IFuture<void>;
	exists(path: string): IFuture<boolean>;
	tryExecuteFileOperation(path: string, operation: () => IFuture<any>, enoentErrorMessage?: string): IFuture<void>;
	deleteFile(path: string): IFuture<void>;
	deleteDirectory(directory: string): IFuture<void>;
	getFileSize(path: string): IFuture<number>;
	futureFromEvent(eventEmitter: NodeJS.EventEmitter, event: string): IFuture<any>;
	createDirectory(path: string): IFuture<void>;
	readDirectory(path: string): IFuture<string[]>;
	readFile(filename: string): IFuture<NodeBuffer>;
	readText(filename: string, encoding?: string): IFuture<string>;
	readJson(filename: string, encoding?: string): IFuture<any>;
	readStdin(): IFuture<string>;
	writeFile(filename: string, data: any, encoding?: string): IFuture<void>;
	appendFile(filename: string, data: any, encoding?: string): IFuture<void>;
	writeJson(filename: string, data: any, space?: string, encoding?: string): IFuture<void>;
	copyFile(sourceFileName: string, destinationFileName: string): IFuture<void>;
	getUniqueFileName(baseName: string): IFuture<string>;
	isEmptyDir(directoryPath: string): IFuture<boolean>;
	isRelativePath(path: string): boolean /* feels so lonely here, I don't have a Future */;
	ensureDirectoryExists(directoryPath: string): IFuture<void>;
	rename(oldPath: string, newPath: string): IFuture<void>;
	/**
	 * Renames specified file to the specified name only in case it exists.
	 * Used to skip ENOENT errors when rename is called directly.
	 * @param {string} oldPath Path to original file that has to be renamed. If this file does not exists, no operation is executed.
	 * @param {string} newPath The path where the file will be moved.
	 * @return {boolean} True in case of successful rename. False in case the file does not exist.
	 */
	renameIfExists(oldPath: string, newPath: string): IFuture<boolean>
	getFsStats(path: string): IFuture<IFsStats>;
	symlink(sourcePath: string, destinationPath: string, type: "file"): IFuture<void>;
	symlink(sourcePath: string, destinationPath: string, type: "dir"): IFuture<void>;
	symlink(sourcePath: string, destinationPath: string, type: "junction"): IFuture<void>;
	symlink(sourcePath: string, destinationPath: string, type?: string): IFuture<void>;
	closeStream(stream: any): IFuture<void>;

	createReadStream(path: string, options?: {
		flags?: string;
		encoding?: string;
		fd?: string;
		mode?: number;
		bufferSize?: number;
		start?: number;
		end?: number;
	}): NodeJS.ReadableStream;
	createWriteStream(path: string, options?: {
		flags?: string;
		encoding?: string;
		string?: string;
	}): any;

	chmod(path: string, mode: number): IFuture<any>;
	chmod(path: string, mode: string): IFuture<any>;

	setCurrentUserAsOwner(path: string, owner: string): IFuture<void>;
	enumerateFilesInDirectorySync(directoryPath: string, filterCallback?: (file: string, stat: IFsStats) => boolean, opts?: { enumerateDirectories?: boolean }): string[];
	getFileShasum(fileName: string): IFuture<string>;
}

// duplicated from fs.Stats, because I cannot import it here
interface IFsStats {
	isFile(): boolean;
	isDirectory(): boolean;
	isBlockDevice(): boolean;
	isCharacterDevice(): boolean;
	isSymbolicLink(): boolean;
	isFIFO(): boolean;
	isSocket(): boolean;
	dev: number;
	ino: number;
	mode: number;
	nlink: number;
	uid: number;
	gid: number;
	rdev: number;
	size: number;
	blksize: number;
	blocks: number;
	atime: Date;
	mtime: Date;
	ctime: Date;
}

interface IOpener {
	open(filename: string, appname?: string): void;
}

interface IErrors {
	fail(formatStr: string, ...args: any[]): void;
	fail(opts: {formatStr?: string; errorCode?: number; suppressCommandHelp?: boolean}, ...args: any[]): void;
	failWithoutHelp(message: string, ...args: any[]): void;
	beginCommand(action: () => IFuture<boolean>, printCommandHelp: () => IFuture<boolean>): IFuture<boolean>;
	verifyHeap(message: string): void;
	printCallStack: boolean;
}

interface ICommandOptions {
	disableAnalytics?: boolean;
	enableHooks?: boolean;
	disableAnalyticsConsentCheck?: boolean;
	disableCommandHelpSuggestion?: boolean;
}

declare const enum ErrorCodes {
	UNKNOWN = 127,
	INVALID_ARGUMENT = 128,
	RESOURCE_PROBLEM = 129
}

interface IFutureDispatcher	 {
	run(): void;
	dispatch(action: () => IFuture<void>): void;
}

interface ICommandDispatcher {
	dispatchCommand(): IFuture<void>;
	completeCommand(): IFuture<boolean>;
}

interface ICancellationService extends IDisposable {
	begin(name: string): IFuture<void>;
	end(name: string): void;
}

interface IQueue<T> {
	enqueue(item: T): void;
	dequeue(): IFuture<T>;
}

interface IChildProcess {
	exec(command: string, options?: any, execOptions?: IExecOptions): IFuture<any>;
	execFile(command: string, args: string[]): IFuture<any>;
	spawn(command: string, args?: string[], options?: any): any; // it returns child_process.ChildProcess you can safely cast to it
	spawnFromEvent(command: string, args: string[], event: string, options?: any, spawnFromEventOptions?: ISpawnFromEventOptions): IFuture<any>;
	tryExecuteApplication(command: string, args: string[], event: string, errorMessage: string, condition?: (childProcess: any) => boolean): IFuture<any>;
}

interface IExecOptions {
	showStderr: boolean;
}

interface ISpawnResult {
	stderr: string;
	stdout: string;
	exitCode: number;
}

interface ISpawnFromEventOptions {
	throwError: boolean;
}

interface IProjectHelper {
	projectDir: string;
	generateDefaultAppId(appName: string, baseAppId: string): string;
	sanitizeName(appName: string): string;
}

interface IPropertiesParser {
	parse(text: string): any;
	createEditor(filePath: string): IFuture<any>;
	saveEditor(): IFuture<void>;
	read(filePath: string): IFuture<any>;
}

interface IDictionary<T> {
	[key: string]: T
}

interface IAnalyticsService {
	checkConsent(): IFuture<void>;
	trackFeature(featureName: string): IFuture<void>;
	trackException(exception: any, message: string): IFuture<void>;
	setStatus(settingName: string, enabled: boolean): IFuture<void>;
	getStatusMessage(settingName: string, jsonFormat: boolean, readableSettingName: string): IFuture<string>;
	isEnabled(settingName: string): IFuture<boolean>;
	track(featureName: string, featureValue: string): IFuture<void>;
}

interface IPrompter extends IDisposable {
	get(schemas: IPromptSchema[]): IFuture<any>;
	getPassword(prompt: string, options?: {allowEmpty?: boolean}): IFuture<string>;
	getString(prompt: string, defaultAction?: () => string): IFuture<string>;
	promptForChoice(promptMessage: string, choices: any[]): IFuture<string>;
	confirm(prompt: string, defaultAction?: () => boolean): IFuture<boolean>;
}

interface IAnalyticsSettingsService {
	canDoRequest(): IFuture<boolean>;
	getUserId(): IFuture<string>;
	getClientName(): string;
	getPrivacyPolicyLink(): string;
}

interface IHostCapabilities {
	capabilities: IDictionary<IHostCapability>;
}

interface IHostCapability {
	debugToolsSupported: boolean;
}

interface IAutoCompletionService {
	enableAutoCompletion(): IFuture<void>;
	disableAutoCompletion(): IFuture<void>;
	isAutoCompletionEnabled(): IFuture<boolean>;
	isObsoleteAutoCompletionEnabled(): IFuture<boolean>;
}

interface IHooksService {
	initialize(commandName: string): void;
	executeBeforeHooks(): IFuture<void>;
	executeAfterHooks(): IFuture<void>;
}

interface IHook {
	name: string;
	fullPath: string;
}

interface ITypeScriptCompilationService {
	initialize(typeScriptFiles: string[], definitionFiles?: string[]): void;
	compileAllFiles(): IFuture<void>;
}

interface IDynamicHelpService {
	isProjectType(...args: string[]): IFuture<boolean>;
	isPlatform(...args: string[]): boolean;
	getLocalVariables(options: { isHtml: boolean }): IFuture<IDictionary<any>>;
}

interface IDynamicHelpProvider {
	isProjectType(args: string[]): IFuture<boolean>;
	getLocalVariables(options: { isHtml: boolean }): IFuture<IDictionary<any>>;
}

interface IMicroTemplateService {
	parseContent(data: string, options: {isHtml: boolean }): string;
}

interface IHtmlHelpService {
	generateHtmlPages(): IFuture<void>;
	getCommandLineHelpForCommand(commandName: string): IFuture<string>;
	openHelpForCommandInBrowser(commandName: string): IFuture<void>;
}

interface IUsbLiveSyncServiceBase {
	initialize(platform: string): IFuture<string>;
	sync(platform: string, appIdentifier: string, projectFilesPath: string, excludedProjectDirsAndFiles: string[], watchGlob: any,
		platformSpecificLiveSyncServices: IDictionary<any>,
		notInstalledAppOnDeviceAction: (device: Mobile.IDevice) => IFuture<boolean>,
		notRunningiOSSimulatorAction: () => IFuture<void>,
		localProjectRootPath?: string,
		beforeLiveSyncAction?: (device: Mobile.IDevice, deviceAppData: Mobile.IDeviceAppData) => IFuture<void>,
		beforeBatchLiveSyncAction?: (filePath: string) => IFuture<string>,
		iOSSimulatorRelativeToProjectBasePathAction?: (projectFile: string) => string): IFuture<void>;
}

interface ISysInfoData {
	/** name and version of the CLI app itself */
	procInfo: string;

	// os stuff
	/** os platform flavour, reported by os.platform */
	platform: string;
	/** Full os name, like `uname -a` on unix, registry query on win */
	os: string;
	/** .net version, applicable to windows only */
	dotNetVer: string;
	/** The command shell in use, usually bash or cmd */
	shell: string;

	// node stuff
	/** node.js version, returned by `process.version` */
	nodeVer: string;
	/** npm version, returned by `npm -v` */
	npmVer: string;
	/** Process architecture, returned by `process.arch` */
	procArch: string;
	/** node-gyp version as returned by `node-gyp -v`*/
	nodeGypVer: string;

	// dependencies
	/** version of java, as returned by `java -version` */
	javaVer: string;
	/** Xcode version string as returned by `xcodebuild -version`. Valid only on Mac */
	xcodeVer: string;
	/** Version string of adb, as returned by `adb version` */
	adbVer: string;
	/** Whether iTunes is installed on the machine */
	itunesInstalled: boolean;
	/** Whether `android` executable can be run */
	androidInstalled: boolean;
	/** mono version, relevant on Mac only **/
	monoVer: string;
	/** git version string, as returned by `git --version` **/
	gitVer: string;
	/** gradle version string as returned by `gradle -v` **/
	gradleVer: string;
	/** javac version string as returned by `javac -version` **/
	javacVersion: string;
	/** pod version string, as returned by `pod --version` **/
	cocoapodVer: string;
}

interface ISysInfo {
	getSysInfo(): ISysInfoData;
}

interface IHostInfo {
	isWindows: boolean;
	isWindows64: boolean;
	isWindows32: boolean;
	isDarwin: boolean;
	isLinux: boolean;
	isLinux64: boolean;
	dotNetVersion(): IFuture<string>;
	isDotNet40Installed(message: string) : IFuture<boolean>;
}

interface Function {
	$inject: {
		args: string[];
		name: string;
	};
}

interface Error {
	stack: string;
}

interface ICommonOptions {
	argv: IYargArgv;
	validateOptions(commandSpecificDashedOptions?: IDictionary<IDashedOption>): void;
	options: IDictionary<any>;
	shorthands: string[];

	log: string;
	verbose: boolean;
	path: string;
	version: boolean;
	help: boolean;
	json: boolean;
	watch: boolean;
	avd: string;
	profileDir: string;
	timeout: string;
	device: string;
	availableDevices: boolean;
	appid: string;
	geny: string;
	debugBrk: boolean;
	debugPort: number;
	getPort: boolean;
	start: boolean;
	stop: boolean;
	ddi: string; // the path to developer  disk image
	justlaunch: boolean;
	skipRefresh: boolean;
	app: string;
	file: string;
	analyticsClient: string;
	force: boolean;
	companion: boolean;
	emulator: boolean;
	sdk: string;
	var: Object;
}

interface IYargArgv extends IDictionary<any> {
	_: string[];
	$0: string;
}

/**
 * Describes dashed option (starting with --) passed on the command line.
 * @interface
 */
interface IDashedOption {
	/**
	 * Type of the option. It can be string, boolean, Array, etc.
	 */
	type: string;
	/**
	 * Shorthand option passed on the command line with `-` sign, for example `-v`
	 */
	alias?: any;
	/**
	 * Defines if the options is mandatory or the number of mandatory arguments.
	 */
	demand?: any;
	/**
	 * @see demand
	 */
	required?: any;
	/**
	 * @see demand
	 */
	require?: any;
	/**
	 * Sets default value of the -- option if it is NOT passed on the command line.
	 */
	default?: any;
	/**
	 * Interpret the value as boolean, even if value is passed for it.
	 */
	boolean?: any;
	/**
	 * Interpret the value as string, especially useful when you have to preserve numbers leading zeroes.
	 */
	string?: any;
	/**
	 * Returns the count of the dashed options passed on the command line.
	 */
	count?: any;
	/**
	 * Describes the usage of option.
	 */
	describe?: any;
	/**
	 * No information about this option. Keep it here for backwards compatibility, but use describe instead.
	 */
	description?: any;
	/**
	 * @see describe
	 */
	desc?: any;
	/**
	 * Specifies either a single option key (string), or an array of options that must be followed by option values.
	 */
	requiresArg?: any;
}

/**
 * Verifies the host OS configuration and prints warnings to the users
 * Code behind of the "doctor" command
 * @interface
 */
interface IDoctorService {
	/**
	 * Verifies the host OS configuration and prints warnings to the users
	 *
	 * @returns {boolean} true if at least one warning was printed
	 */
	printWarnings(): boolean;
}

interface IPlatformSpecificLiveSyncService {
	restartApplication(deviceAppData: Mobile.IDeviceAppData, localToDevicePaths?: Mobile.ILocalToDevicePathData[]): IFuture<void>;
}
interface IUtils {
	getParsedTimeout(defaultTimeout: number): number;
	getMilliSecondsTimeout(defaultTimeout: number): number;
}
interface IBinaryPlistParser {
	parseFile(plistFilePath: string): IFuture<any>;
}

/**
 *	Used for interaction with various resources located in a resources folder.
 *	@interface
 */
interface IResourceLoader {
	/**
	 * Get an absolute path to a resource based on a relative one.
	 * @param  {string} path Relative path to resource
	 * @return {string}      Absolute path to resource
	 */
	resolvePath(path: string): string;
	/**
	 * Opens a resource file for reading.
	 * @param  {string} path Relative path to resource
	 * @return {NodeJS.ReadableStream} Read stream to the resource file
	 */
	openFile(path: string): NodeJS.ReadableStream;

	readText(path: string): IFuture<string>;

	/**
	 * Reads the contents of a resource file in JSON format.
	 * @param  {string}       path Relative path to resource
	 * @return {IFuture<any>}      Object based on the JSON contents of the resource file.
	 */
	readJson(path: string): IFuture<any>;
	/**
	 * Returns the path to App_Resources folder, which contains all resources for a given application.
	 * @param  {string} framework The application's framework name
	 * @return {string}           The absolute path to App_Resources folder
	 */
	getPathToAppResources(framework: string): string;
}

interface IPluginVariablesHelper {
	getPluginVariableFromVarOption(variableName: string, configuration?: string): any;
	simplifyYargsObject(obj: any, configuration?: string): any;
}
