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
	writeFile(filename: string, data: any, encoding?: string): IFuture<void>;
	appendFile(filename: string, data: any, encoding?: string): IFuture<void>;
	writeJson(filename: string, data: any, space?: string, encoding?: string): IFuture<void>;
	copyFile(sourceFileName: string, destinationFileName: string): IFuture<void>;
	getUniqueFileName(baseName: string): IFuture<string>;
	isEmptyDir(directoryPath: string): IFuture<boolean>;
	isRelativePath(path: string): boolean /* feels so lonely here, I don't have a Future */;
	ensureDirectoryExists(directoryPath: string): IFuture<void>;
	rename(oldPath: string, newPath: string): IFuture<void>;
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
	}): any;
	createWriteStream(path: string, options?: {
		flags?: string;
		encoding?: string;
		string?: string;
	}): any;

	chmod(path: string, mode: number): IFuture<any>;
	chmod(path: string, mode: string): IFuture<any>;

	setCurrentUserAsOwner(path: string, owner: string): IFuture<void>;
	enumerateFilesInDirectorySync(directoryPath: string, filterCallback?: (file: string, stat: IFsStats) => boolean): string[];
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
}

declare const enum ErrorCodes {
	UNKNOWN = 127,
	INVALID_ARGUMENT = 128
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
	exec(command: string, options?: any): IFuture<any>;
	execFile(command: string, args: string[]): IFuture<any>;
	spawn(command: string, args?: string[], options?: any): any; // it returns child_process.ChildProcess you can safely cast to it
	spawnFromEvent(command: string, args: string[], event: string, options?: any, spawnFromEventOptions?: ISpawnFromEventOptions): IFuture<any>;
	tryExecuteApplication(command: string, args: string[], event: string, errorMessage: string, condition?: (childProcess: any) => boolean): IFuture<any>;
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
}

interface IDictionary<T> {
	[key: string]: T
}

interface IAnalyticsService {
	checkConsent(featureName: string): IFuture<void>;
	trackFeature(featureName: string): IFuture<void>;
	trackException(exception: any, message: string): IFuture<void>;
	setAnalyticsStatus(enabled: boolean): IFuture<void>;
	disableAnalytics(): IFuture<void>;
	getStatusMessage(): IFuture<string>;
	isEnabled(): IFuture<boolean>;
	track(featureName: string, featureValue: string): IFuture<void>;
}

interface IPrompter extends IDisposable {
	get(schema: IPromptSchema[]): IFuture<any>;
	getPassword(prompt: string, options?: {allowEmpty?: boolean}): IFuture<string>;
	getString(prompt: string): IFuture<string>;
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
	/** version string of ant, as returned by `ant -version` */
	antVer: string;
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
