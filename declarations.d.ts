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
	deleteFile(path: string): IFuture<void>;
	deleteDirectory(directory: string): IFuture<void>;
	getFileSize(path: string): IFuture<number>;
	futureFromEvent(eventEmitter: EventEmitter, event: string): IFuture<any>;
	createDirectory(path: string): IFuture<void>;
	readDirectory(path: string): IFuture<string[]>;
	readFile(filename: string): IFuture<NodeBuffer>;
	readText(filename: string, encoding?: string): IFuture<string>;
	readJson(filename: string, encoding?: string): IFuture<any>;
	writeFile(filename: string, data: any, encoding?: string): IFuture<void>;
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
	executeAction(action: Function): any;
	validateArgs(client: string, knownOpts: any, shorthands: any): any;
	validateYargsArguments(parsed: any, knownOpts: any, shorthands: any, clientName?: string): void;
	printCallStack: boolean;
}

interface ICommandOptions {
	disableAnalytics?: boolean;
	enableHooks?: boolean;
}

declare enum ErrorCodes {
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
}

interface IPropertiesParser {
	parse(text: string): any;
	createEditor(filePath: string): IFuture<any>;
}

interface IDictionary<T> {
	[key: string]: T
}

interface IStringDictionary extends IDictionary<string> { }

interface IAnalyticsService {
	checkConsent(featureName: string): IFuture<void>;
	trackFeature(featureName: string): IFuture<void>;
	trackException(exception: any, message: string): IFuture<void>;
	setAnalyticsStatus(enabled: boolean): IFuture<void>;
	disableAnalytics(): IFuture<void>;
	getStatusMessage(): IFuture<string>;
	isEnabled(): IFuture<boolean>;
}

interface IPrompter extends IDisposable {
	start(): void;
	get(schema: IPromptSchema): IFuture<any>;
	getPassword(prompt: string, options?: {allowEmpty?: boolean}): IFuture<string>;
	confirm(prompt: string, defaultAction?: () => string): IFuture<boolean>;
	history(name: string): IPromptHistoryValue;
	override(object: any): void;
}

interface IAnalyticsSettingsService {
	canDoRequest(): IFuture<boolean>;
	getUserId():  IFuture<string>;
}

interface IHostCapabilities {
	debugToolsSupported: boolean;
}

interface IAutoCompletionService {
	enableAutoCompletion(): IFuture<void>;
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
	initialize(typeScriptFiles: string[]): void;
	compileAllFiles(): IFuture<void>;
}

interface IDynamicHelpService {
	isProjectType(...args: string[]): IFuture<boolean>;
	isPlatform(...args: string[]): boolean;
	getLocalVariables(): IFuture<IDictionary<any>>;
}

interface IDynamicHelpProvider {
	isProjectType(args: string[]): IFuture<boolean>;
	getLocalVariables(): IFuture<IDictionary<any>>;
}

interface IMicroTemplateService {
	parseContent(data: string): string;
}