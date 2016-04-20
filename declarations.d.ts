interface Object {
	[key: string]: any;
}

interface IStringDictionary extends IDictionary<string> { }


/**
 * Describes iTunes Connect application types
 */
interface IiTunesConnectApplicationType {
	/**
	 * Applications developed for iOS
	 * @type {string}
	 */
	iOS: string;
	/**
	 * Applications developed for Mac OS
	 * @type {string}
	 */
	Mac: string;
}

/**
 * Descibes iTunes Connect applications
 */
interface IiTunesConnectApplication {
	/**
	 * Unique Apple ID for each application. Automatically generated and assigned by Apple.
	 * @type {string}
	 */
	adamId: string;
	/**
	 * No information available.
	 * @type {number}
	 */
	addOnCount: number;
	/**
	 * The application's bundle identifier.
	 * @type {string}
	 */
	bundleId: string;
	/**
	 * Application's name
	 * @type {string}
	 */
	name: string;
	/**
	 * Application's stock keeping unit. User-defined unique string to keep track of the applications
	 * @type {string}
	 */
	sku: string;
	/**
	 * Application's type
	 * @type {IItunesConnectApplicationTypes}
	 */
	type: string;
	/**
	 * Application's current version
	 * @type {string}
	 */
	version: string;
}

/**
 * Describes data returned from querying itunes' Content Delivery api
 */
interface IContentDeliveryBody {
	/**
	 * Error object - likely present if result's Success is false.
	 */
	error?: Error;

	/**
	 * Query results.
	 */
	result: {
		/**
		 * A list of the user's applications.
		 * @type {IItunesConnectApplication[]}
		 */
		Applications: IiTunesConnectApplication[];
		/**
		 * Error code - likely present if Success is false.
		 * @type {number}
		 */
		ErrorCode?: number;
		/**
		 * Error message - likely present if Success is false.
		 * @type {string}
		 */
		ErrorMessage?: string;
		/**
		 * Error message - likely present if Success is false.
		 * @type {string[]}
		 */
		Errors?: string[];
		/**
		 * Indication whether the query was a success or not.
		 * @type {boolean}
		 */
		Success: boolean;
	};
}

declare module Server {
	interface IResponse {
		response: any;
		body?: any;
		headers: any;
		error?: Error;
	}

	interface IHttpClient {
		httpRequest(url: string): IFuture<IResponse>;
		httpRequest(options: any): IFuture<IResponse>;
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
	unzip(zipFile: string, destinationDir: string, options?: { overwriteExisitingFiles?: boolean; caseSensitive?: boolean }, fileFilters?: string[]): IFuture<void>;
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
	enumerateFilesInDirectorySync(directoryPath: string, filterCallback?: (file: string, stat: IFsStats) => boolean, opts?: { enumerateDirectories?: boolean, includeEmptyDirectories?: boolean }): string[];
	/**
	 * Hashes a file's contents.
	 * @param {string} fileName Path to file
	 * @param {Object} options algorithm and digest encoding. Default values are sha1 for algorithm and hex for encoding
	 * @return {IFuture<string>} The computed shasum
	 */
	getFileShasum(fileName: string, options?: { algorithm?: string, encoding?: string }): IFuture<string>;

	// shell.js wrappers
	/**
	 * @param (string) options Options, can be undefined or a combination of "-r" (recursive) and "-f" (force)
	 * @param (string[]) files files and direcories to delete
	 */
	rm(options: string, ...files: string[]): void;
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
	fail(opts: { formatStr?: string; errorCode?: number; suppressCommandHelp?: boolean }, ...args: any[]): void;
	failWithoutHelp(message: string, ...args: any[]): void;
	beginCommand(action: () => IFuture<boolean>, printCommandHelp: () => IFuture<boolean>): IFuture<boolean>;
	verifyHeap(message: string): void;
	printCallStack: boolean;
}

interface ICommandOptions {
	disableAnalytics?: boolean;
	enableHooks?: boolean;
	disableCommandHelpSuggestion?: boolean;
}

declare const enum ErrorCodes {
	UNKNOWN = 127,
	INVALID_ARGUMENT = 128,
	RESOURCE_PROBLEM = 129
}

interface IFutureDispatcher {
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
	/**
	 * This is a special case of the child_process.spawn() functionality for spawning Node.js processes.
	 * In addition to having all the methods in a normal ChildProcess instance, the returned object has a communication channel built-in.
	 * Note: Unlike the fork() POSIX system call, child_process.fork() does not clone the current process.
	 * @param {string} modulePath String The module to run in the child
	 * @param {string[]} args Array List of string arguments You can access them in the child with 'process.argv'.
	 * @param {string} options Object
	 * @return {child_process} ChildProcess object.
	 */
	fork(modulePath: string, args?: string[], options?: { cwd?: string, env?: any, execPath?: string, execArgv?: string[], silent?: boolean, uid?: number, gid?: number }): any;
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
	setStatus(settingName: string, enabled: boolean, doNotTrackSetting?: boolean): IFuture<void>;
	getStatusMessage(settingName: string, jsonFormat: boolean, readableSettingName: string): IFuture<string>;
	isEnabled(settingName: string): IFuture<boolean>;
	track(featureName: string, featureValue: string): IFuture<void>;
	/**
	 * Tries to stop current eqatec monitor, clean it's state and remove the process.exit event handler.
	 * @param {string|number} code - Exit code as the method is used for process.exit event handler.
	 * @return void
	 */
	tryStopEqatecMonitor(code?: string | number): void;
}

interface IAllowEmpty {
	allowEmpty?: boolean
}

interface IPrompterOptions extends IAllowEmpty {
	defaultAction?: () => string
}

interface IPrompter extends IDisposable {
	get(schemas: IPromptSchema[]): IFuture<any>;
	getPassword(prompt: string, options?: IAllowEmpty): IFuture<string>;
	getString(prompt: string, options?: IPrompterOptions): IFuture<string>;
	promptForChoice(promptMessage: string, choices: any[]): IFuture<string>;
	confirm(prompt: string, defaultAction?: () => boolean): IFuture<boolean>;
}

interface IAnalyticsSettingsService {
	canDoRequest(): IFuture<boolean>;
	getUserId(): IFuture<string>;
	getClientName(): string;
	getPrivacyPolicyLink(): string;
	/**
	 * Gets current user sessions count.
	 * @param {string} projectName The analytics project id for which the counter should be taken.
	 * @return {number} Number of user sessions.
	 */
	getUserSessionsCount(projectName: string): IFuture<number>;

	/**
	 * Set the number of user sessions.
	 * @param {number} count The number that will be set for user sessions.
	 * @param {string} projectName The analytics project id for which the counter should be set.
	 * @return {IFuture<void>}
	 */
	setUserSessionsCount(count: number, projectName: string): IFuture<void>;
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
	executeBeforeHooks(commandName: string, hookArguments?: IDictionary<any>): IFuture<void>;
	executeAfterHooks(commandName: string, hookArguments?: IDictionary<any>): IFuture<void>;
}

interface IHook {
	name: string;
	fullPath: string;
}

/**
 * Describes TypeScript compilation methods.
 */
interface ITypeScriptCompilationService {
	/**
	 * Compiles specified files only. Options are read from CLI's config file. Disregards tsconfig.json.
	 * @param {any} compilerOptions: Specifies if noEmitOnError option is true or false. When it is true, any warning will prevent .js generation.
	 * @param {string[]} typeScriptFiles The files that will be compiled.
	 * @param {string[]} definitionFiles @optional The definition files used for compilation.
	 * @return {IFuture<void>}
	 */
	compileFiles(compilerOptions: { noEmitOnError: boolean }, typeScriptFiles: string[], definitionFiles?: string[]): IFuture<void>;

	/**
	 * Spawns tsc directly without options. Tsc will respect tsconfig.json file in case it exists and all of its options.
	 * @param {any} compilerOptions: Specifies if noEmitOnError option is true or false. When it is true, any warning will prevent .js generation.
	 * @return {IFuture<void>}
	 */
	compileWithDefaultOptions(compilerOptions: { noEmitOnError: boolean }): IFuture<void>;
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
	parseContent(data: string, options: { isHtml: boolean }): string;
}

interface IHtmlHelpService {
	generateHtmlPages(): IFuture<void>;
	getCommandLineHelpForCommand(commandName: string): IFuture<string>;
	openHelpForCommandInBrowser(commandName: string): IFuture<void>;
}

/**
 * Used to talk to xcode-select command-line tool.
 */
interface IXcodeSelectService {
	/**
	 * Get the path to Contents directory inside Xcode.app.
	 * With a default installation this path is /Applications/Xcode.app/Contents
	 * @return {IFuture<string>}
	 */
	getContentsDirectoryPath(): IFuture<string>;
	/**
	 * Get the path to Developer directory inside Xcode.app.
	 * With a default installation this path is /Applications/Xcode.app/Contents/Developer/
	 * @return {IFuture<string>}
	 */
	getDeveloperDirectoryPath(): IFuture<string>;
	/**
	 * Get version of the currently used Xcode.
	 * @return {IFuture<IVersionData>}
	 */
	getXcodeVersion(): IFuture<IVersionData>;
}

interface ILiveSyncServiceBase {
	/**
	 * If platform parameter is specified returns it
	 * If platform parameter is not specified returns the platform of the connected device(s)
	 * If devices from different platforms are connected throws an error
	 */
	getPlatform(platform?: string): IFuture<string>;
	/**
	 * If watch option is not specified executes full sync
	 * If watch option is specified executes partial sync
	 */
	sync(data: ILiveSyncData, filePaths?: string[]): IFuture<void>;
}

interface ISyncBatch {
	/**
	 * Checks if there is a pending sync
	 */
	syncPending: boolean;
	/**
	 * Adds the file to the sync queue. All files from the queue will be pushed on the device after 250ms.
	 */
	addFile(filePath: string): void;
	syncFiles(syncAction: (filesToSync: string[]) => IFuture<void>): IFuture<void>;
}

interface ILiveSyncData {
	platform: string;
	/** Application identifier */
	appIdentifier: string;
	/** The path to a directory that contains prepared project files for sync */
	projectFilesPath: string;
	/** The path to a directory that is watched */
	syncWorkingDirectory: string;
	canExecuteFastSync?: boolean;
	forceExecuteFullSync?: boolean;
	excludedProjectDirsAndFiles?: string[];
	/**
	 * Describes if the livesync action can be executed on specified device.
	 * The method is called for each device.
	 */
	canExecute?(device: Mobile.IDevice): boolean;
}

interface IPlatformLiveSyncService {
	/**
	 * Refreshes the application's content on a device
	 */
	refreshApplication(deviceAppData: Mobile.IDeviceAppData, localToDevicePaths: Mobile.ILocalToDevicePathData[], canExecuteFastSync?: boolean): IFuture<void>;
	/**
	 * Removes specified files from a connected device
	 */
	removeFiles(appIdentifier: string, localToDevicePaths: Mobile.ILocalToDevicePathData[]): IFuture<void>;
	/**
	 * Specifies some action that will be executed before every sync operation
	 */
	beforeLiveSyncAction?(deviceAppData: Mobile.IDeviceAppData): IFuture<void>;
	afterInstallApplicationAction?(deviceAppData: Mobile.IDeviceAppData, localToDevicePaths: Mobile.ILocalToDevicePathData[]): IFuture<void>;
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
	/** xcodeproj gem location, as returned by `which gem xcodeproj` **/
	xcodeprojGemLocation: string;
}

interface ISysInfo {
	/**
	 * Returns information for the current system.
	 * @param {string} pathToPackageJson Path to package.json of the CLI.
	 * @param {any} androidToolsInfo Defines paths to adb and android executables.
	 * @return {IFuture<ISysInfoData>} Object containing information for current system.
	 */
	getSysInfo(pathToPackageJson: string, androidToolsInfo?: { pathToAdb: string, pathToAndroid: string }): IFuture<ISysInfoData>;
}

interface IHostInfo {
	isWindows: boolean;
	isWindows64: boolean;
	isWindows32: boolean;
	isDarwin: boolean;
	isLinux: boolean;
	isLinux64: boolean;
	dotNetVersion(): IFuture<string>;
	isDotNet40Installed(message: string): IFuture<boolean>;
}

interface Function {
	$inject: {
		args: string[];
		name: string;
	};
}

/**
 * Extends Nodejs' Error interface.
 * The native interface already has name and message properties
 */
interface Error {
	/**
	 * Error's stack trace
	 * @type {string}
	 */
	stack: string;
	/**
	 * Error's code - could be a string ('ENOENT'), as well as a number (127)
	 * @type {string|number}
	 */
	code?: string | number;
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
	template: string;
	var: Object;
	default: Boolean;
	release: boolean;
	count: number;
	hooks: boolean;
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
	 * @param configOptions: defines if the result should be tracked by Analytics
	 * @returns {IFuture<boolean>} true if at least one warning was printed
	 */
	printWarnings(configOptions?: { trackResult: boolean }): IFuture<boolean>;
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

/**
 * Used for getting strings for informational/error messages.
 */
interface IMessagesService {
	/**
	 * Array of the paths to the .json files containing all the messages.
	 * @type {string[]}
	 */
	pathsToMessageJsonFiles: string[];

	/**
	 * @param  {string} 	id		Message's key in corresponding messages json file, could be complex (e.g. 'iOS.iTunes.ConnectError').
	 * @param  {string[]} 	args	Additional arguments used when the message's value is a string format.
	 * @return {string}				The value found under the given id. If no value is found returns the id itself.
	 */
	getMessage(id: string, ...args: string[]): string;
}

/**
 * Describes generated code parts.
 */
interface IServiceContractClientCode {
	interfaceFile: string;
	implementationFile: string;
}

/**
 * Used for code generation.
 */
interface IServiceContractGenerator {
	/**
	 * Generate code implementation along with interface
	 * @param  {string}                              definitionsPath The path to the desired parent .d.ts file
	 * @return {IFuture<IServiceContractClientCode>}                 The generated code parts
	 */
	generate(definitionsPath?: string): IFuture<IServiceContractClientCode>;
}

/**
 * Describes Registry values returned from winreg
 */
interface IWinRegResult {
	/**
	 * The hostname, if it has been set in the options.
	 */
	host: string;

	/**
	 * The hive id, as specified in the options
	 */
	hive: string;
	/**
	 * The key, as specified in the options
	 */
	key: string;

	/**
	 * The name of the registry value
	 */
	name: string;

	/**
	 * One of the types:
	 * 	REG_SZ a string value
	 * 	REG_MULTI_SZ a multiline string value
	 * 	REG_EXPAND_SZ an expandable string value
	 * 	REG_DWORD a double word value (32 bit integer)
	 * 	REG_QWORD a quad word value (64 bit integer)
	 * 	REG_BINARY a binary value
	 * 	REG_NONE a value of unknown type
	 */
	type: string;

	/**
	 * A string containing the value
	 */
	value: string;
}

/**
 * Describes single registry available for search.
 */
interface IHiveId {
	/**
	 * Name of the registry that will be checked.
	 */
	registry: string;
}

/**
 * Describes available for search registry ids.
 */
interface IHiveIds {
	/**
	 * HKEY_LOCAL_MACHINE
	 */
	HKLM: IHiveId;

	/**
	 * HKEY_CURRENT_USER
	 */
	HKCU: IHiveId;

	/**
	 * HKEY_CLASSES_ROOT
	 */
	HKCR: IHiveId;

	/**
	 * HKEY_CURRENT_CONFIG
	 */
	HKCC: IHiveId;

	/**
	 * HKEY_USERS
	 */
	HKU: IHiveId;
}

/**
 * Defines reading values from registry. Wrapper for node-winreg module.s
 */
interface IWinReg {
	/**
	 * Gets specified value from the registry.
	 * The following options are processed by the Winreg constructor:
	 * @param {string} valueName Value that has to be checked in the registry.
	 * @param {IHiveId} hive The optional hive id, the default is HKLM.
	 * @param {string} key The optional key, the default is the root key
	 * @param {string} host The optional hostname, must start with the '\\' sequence
	 */
	getRegistryValue(valueName: string, hive?: IHiveId, key?: string, host?: string): IFuture<IWinRegResult>;

	/**
	 * Gets object containing available registries for search.
	 */
	registryKeys: IHiveIds;
}

/**
 * Used to show indication that a process is running
 */
interface IProgressIndicator {
	/**
	 * Prints indication that a process is running
	 * @param  {IFuture<any>}	future		process
	 * @param  {number}			timeout		time interval for printing indication
	 * @param  {boolean}		options		whether to surpress the trailing new line printed after the process ends
	 * @return {IFuture<void>}
	 */
	showProgressIndicator(future: IFuture<any>, timeout: number, options?: { surpressTrailingNewLine?: boolean }): IFuture<void>;
}

/**
 * Describes project file that should be livesynced
 */
interface IProjectFileInfo {
	/**
	 * Full path to the file that has to be livesynced.
	 */
	filePath: string;

	/**
	 * Filename that will be transefered on the device. This is the original filename with stripped platform and configuration names.
	 */
	onDeviceFileName: string;

	/**
	 * Defines if the file should be included in the transfer. For example when device is Android, files that contain iOS in the name should not be synced.
	 */
	shouldIncludeFile: boolean;
}

interface IProjectFilesManager {
	/**
	 * Enumerates all files and directories from the specified project files path.
	 */
	getProjectFiles(projectFilesPath: string, excludedProjectDirsAndFiles?: string[], filter?: (filePath: string, stat: IFsStats) => IFuture<boolean>, opts?: any): string[];
	/**
	 * Checks if the file is excluded
	 */
	isFileExcluded(filePath: string, excludedProjectDirsAndFiles?: string[]): boolean;
	/**
	 * Returns an object that maps every local file path to device file path
	 * If projectFiles parameter is not specified enumerates the files from the specified projectFilesPath
	 */
	createLocalToDevicePaths(deviceAppData: Mobile.IDeviceAppData, projectFilesPath: string, files?: string[], excludedProjectDirsAndFiles?: string[]): Mobile.ILocalToDevicePathData[];
	/**
	 * Handle platform specific files
	 */
	processPlatformSpecificFiles(directoryPath: string, platform: string, excludedDirs?: string[]): IFuture<void>;
}

interface IProjectFilesProvider {
	/**
	 * Checks if the file is excluded
	 */
	isFileExcluded(filePath: string): boolean;
	/**
	 * Performs local file path mapping
	 */
	mapFilePath(filePath: string, platform: string): string;

	/**
	 * Returns information about file in the project, that includes file's name on device after removing platform or configuration from the name.
	 * @param {string} filePath Path to the project file.
	 * @param {string} optional Platform for which to get the information.
	 * @return {IProjectFileInfo}
	 */
	getProjectFileInfo(filePath: string, platform?: string): IProjectFileInfo;
	/**
	 * Parses file by removing platform or configuration from its name.
	 * @param {string} filePath Path to the project file.
	 * @return {string} Parsed file name or original file name in case it does not have platform/configuration in the filename.
	 */
	getPreparedFilePath(filePath: string): string;
}

interface ILiveSyncProvider {
	/**
	 * Returns a dictionary that map platform to platform specific livesync service
	 */
	platformSpecificLiveSyncServices: IDictionary<any>;
	/**
	 * Builds the application and returns the package file path
	 */
	buildForDevice(device: Mobile.IDevice): IFuture<string>;
	/**
	 * Prepares the platform for sync
	 */
	preparePlatformForSync(platform: string): IFuture<void>;
	/**
	 * Checks if the specified file can be fast synced.
	 */
	canExecuteFastSync(filePath: string, platform?: string): boolean;
}

/**
 * Describes imformation about the version of component
 */
interface IVersionInformation {
	/**
	 * Component name.
	 */
	componentName: string;
	/**
	 * The current version of the component if available.
	 */
	currentVersion?: string;
	/**
	 * The latest available version of the component.
	 */
	latestVersion: string;
}

interface IVersionData {
	major: string;
	minor: string;
	patch: string;
}

