///<reference path="../.d.ts"/>

declare module Mobile {
	interface ISyncOptions {
		skipRefresh?: boolean;
	}

	/**
	 * Describes available information for a device.
	 */
	interface IDeviceInfo {
		/**
		 * Unique identifier of the device.
		 */
		identifier: string;

		/**
		 * The name of the device.
		 * For Android this is the value of device's 'ro.product.name' property.
		 * For iOS this is the value of device's 'DeviceName' property.
		 */
		displayName: string;

		/**
		 * Device model.
		 * For Android this is the value of device's 'ro.product.model' property.
		 * For iOS this is the value of device's 'ProductType' property.
		 */
		model: string;

		/**
		 * Version of the OS.
		 * For Android this is the value of device's 'ro.build.version.release' property.
		 * For iOS this is the value of device's 'ProductVersion' property.
		 */
		version: string;

		/**
		 * Vendor of the device.
		 * For Android this is the value of device's 'ro.product.brand' property.
		 * For iOS the value is always "Apple".
		 */
		vendor: string;

		/**
		 * Device's platform.
		 * Can be Android or iOS.
		 */
		platform: string;

		/**
		 * Status of device describing if you can work with this device or there's communication error.
		 * Can be Connected or Unauthorized.
		 */
		status: string;

		/**
		 * Additional information for errors that prevents working with this device.
		 * It will be null when status is Connected.
		 */
		errorHelp: string;

		/**
		 * Defines if the device is tablet or not.
		 * For Android the value will be true when device's 'ro.build.characteristics' property contains "tablet" word or when the 'ro.build.version.release' is 3.x
		 * For iOS the value will be true when device's 'ProductType' property contains "ipad" word.
		 */
		isTablet: boolean;

		/**
		 * Defines if the device is emulator or not.
		 * Can be "Device" or "Emulator"
		 */
		type: string;

		/**
		 * Optional property describing the color of the device.
		 * Available for iOS only - the value of device's 'DeviceColor' property.
		 */
		color?: string;

		/**
		 *  Optional property describing the architecture of the device
		 *  Available for iOS only - can be "armv7" or "arm64"
		 */
		activeArchitecture?: string;
	}

	interface IDevice {
		deviceInfo: Mobile.IDeviceInfo;
		applicationManager: Mobile.IDeviceApplicationManager;
		fileSystem: Mobile.IDeviceFileSystem;
		isEmulator: boolean;
		openDeviceLogStream(): void;
	}

	interface IAndroidDevice extends IDevice {
		adb: Mobile.IAndroidDebugBridge;
	}

	interface IiOSDevice extends IDevice {
		startService(serviceName: string): number;
		mountImage(): IFuture<void>;
		tryExecuteFunction<TResult>(func: () => TResult): TResult;
		connectToPort(port: number): any;
	}

	interface IiOSSimulator extends IDevice { }

	interface IDeviceAppData {
		appIdentifier: string;
		device: Mobile.IDevice;
		platform: string;
		deviceProjectRootPath: string;
		isLiveSyncSupported(): IFuture<boolean>;
	}

	interface IDeviceAppDataFactory {
		create<T extends Mobile.IDeviceAppData>(appIdentifier: string, platform: string, device: Mobile.IDevice, liveSyncOptions?: { isForCompanionApp: boolean }): T;
	}

	interface IDeviceAppDataFactoryRule {
		vanilla: any;
		companion?: any;
	}

	interface IDeviceAppDataProvider {
		createFactoryRules(): IDictionary<Mobile.IDeviceAppDataFactoryRule>;
	}

	interface IAndroidLiveSyncService {
		liveSyncCommands: any;
		livesync(appIdentifier: string, liveSyncRoot: string, commands: string[]): IFuture<void>;
		createCommandsFileOnDevice(commandsFileDevicePath: string, commands: string[]): IFuture<void>;
	}

	interface ILogcatHelper {
		start(deviceIdentifier: string): void;
	}

	interface IDeviceLogProvider {
		logData(line: string, platform: string, deviceIdentifier: string): void;
		setLogLevel(level: string, deviceIdentifier?: string): void;
	}

	/**
	 * Describes common filtering rules for device logs.
	 */
	interface ILogFilter {
		/**
		 * The logging level that will be used for filtering in case logLevel is not passed to filterData method.
		 * Defaults to INFO.
		 */
		loggingLevel: string;

		/**
		 * Filters data for specified platform.
		 * @param {string} platform The platform for which is the device log.
		 * @param {string} data The input data for filtering.
		 * @param {string} logLevel @optional The logging level based on which input data will be filtered.
		 * @return {string} The filtered result based on the input or null when the input data shouldn't be shown.
		 */
		filterData(platform: string, data: string, logLevel?: string): string;
	}

	/**
	 * Describes filtering logic for specific platform (Android, iOS).
	 */
	interface IPlatformLogFilter {
		/**
		 * Filters passed string data based on the passed logging level.
		 * @param {string} data The string data that will be checked based on the logging level.
		 * @param {string} logLevel Selected logging level.
		 * @return {string} The filtered result based on the input or null when the input data shouldn't be shown.
		 */
		filterData(data: string, logLevel: string): string;
	}

	interface ILoggingLevels {
		info: string;
		full: string;
	}

	interface IDeviceApplicationManager extends NodeJS.EventEmitter {
		getInstalledApplications(): IFuture<string[]>;
		isApplicationInstalled(appIdentifier: string): IFuture<boolean>;
		installApplication(packageFilePath: string): IFuture<void>;
		uninstallApplication(appIdentifier: string): IFuture<void>;
		reinstallApplication(appIdentifier: string, packageFilePath: string): IFuture<void>;
		startApplication(appIdentifier: string): IFuture<void>;
		stopApplication(appIdentifier: string): IFuture<void>;
		restartApplication(appIdentifier: string, bundleExecutable?: string): IFuture<void>;
		canStartApplication(): boolean;
		checkForApplicationUpdates(): IFuture<void>;
		isLiveSyncSupported(appIdentifier: string): IFuture<boolean>;
		getApplicationsLiveSyncSupportedStatus(newApplications: string[]): IFuture<void>;
	}

	interface IApplicationLiveSyncStatus {
		applicationIdentifier: string;
		isLiveSyncSupported: boolean;
	}

	interface IDeviceFileSystem {
		listFiles(devicePath: string): IFuture<void>;
		getFile(deviceFilePath: string): IFuture<void>;
		putFile(localFilePath: string, deviceFilePath: string): IFuture<void>;
		deleteFile?(deviceFilePath: string, appIdentifier: string): void;
		transferFiles(deviceAppData: Mobile.IDeviceAppData, localToDevicePaths: Mobile.ILocalToDevicePathData[]): IFuture<void>;
		transferDirectory(deviceAppData: Mobile.IDeviceAppData, localToDevicePaths: Mobile.ILocalToDevicePathData[], projectFilesPath: string): IFuture<void>;
		transferFile?(localFilePath: string, deviceFilePath: string): IFuture<void>;
		createFileOnDevice?(deviceFilePath: string, fileContent: string): IFuture<void>;
	}

	interface IAndroidDebugBridge {
		executeCommand(args: string[]): IFuture<any>;
		executeShellCommand(args: string[]): IFuture<any>;
		sendBroadcastToDevice(action: string, extras?: IStringDictionary): IFuture<number>;
	}

	interface IDebugOnDeviceSetup {
		frontEndPath?: string;
	}

	interface IDeviceDiscovery extends NodeJS.EventEmitter {
		startLookingForDevices(): IFuture<void>;
		checkForDevices(): IFuture<void>;
	}

	interface IAndroidDeviceDiscovery extends IDeviceDiscovery {
		ensureAdbServerStarted(): IFuture<any>;
	}

	interface IDevicesServicesInitializationOptions {
		platform?: string;
		deviceId?: string;
		skipInferPlatform?: boolean;
	}

	interface IDevicesService {
		hasDevices: boolean;
		deviceCount: number;
		execute(action: (device: Mobile.IDevice) => IFuture<void>, canExecute?: (dev: Mobile.IDevice) => boolean, options?: { allowNoDevices?: boolean }): IFuture<void>;
		initialize(data?: IDevicesServicesInitializationOptions): IFuture<void>;
		platform: string;
		getDevices(): Mobile.IDeviceInfo[];
		getDevicesForPlatform(platform: string): Mobile.IDevice[];
		getDeviceInstances(): Mobile.IDevice[];
		getDeviceByDeviceOption(): Mobile.IDevice;
		isAndroidDevice(device: Mobile.IDevice): boolean;
		isiOSDevice(device: Mobile.IDevice): boolean;
		isiOSSimulator(device: Mobile.IDevice): boolean;
		isOnlyiOSSimultorRunning(): boolean;
		isAppInstalledOnDevices(deviceIdentifiers: string[], appIdentifier: string): IFuture<boolean>[];
		setLogLevel(logLevel: string, deviceIdentifier?: string): void;
		deployOnDevices(deviceIdentifiers: string[], packageFile: string, packageName: string): IFuture<void>[];
		startDeviceDetectionInterval(): void;
		stopDeviceDetectionInterval(): void;
	}

	interface IiTunesValidator {
		getError(): IFuture<string>;
	}

	interface IiOSCore {
		getCoreFoundationLibrary(): any;
		getMobileDeviceLibrary(): any;
	}

	interface ICoreFoundation {
		runLoopRun(): void;
		runLoopGetCurrent(): any;
		stringCreateWithCString(alloc: NodeBuffer, str: string, encoding: number): NodeBuffer;
		dictionaryGetValue(theDict: NodeBuffer, value: NodeBuffer): NodeBuffer;
		numberGetValue(num: NodeBuffer, theType: number, valuePtr: NodeBuffer): boolean;
		kCFRunLoopCommonModes(): NodeBuffer;
		kCFRunLoopDefaultMode(): NodeBuffer;
		kCFTypeDictionaryKeyCallBacks(): NodeBuffer;
		kCFTypeDictionaryValueCallBacks(): NodeBuffer;
		runLoopTimerCreate(allocator: NodeBuffer, fireDate: number, interval: number, flags: number, order: number, callout: NodeBuffer, context: any): NodeBuffer;
		absoluteTimeGetCurrent(): number;
		runLoopAddTimer(r1: NodeBuffer, timer: NodeBuffer, mode: NodeBuffer): void;
		runLoopRemoveTimer(r1: NodeBuffer, timer: NodeBuffer, mode: NodeBuffer): void;
		runLoopStop(r1: any): void;
		convertCFStringToCString(cfstr: NodeBuffer): string;
		dictionaryCreate(allocator: NodeBuffer, keys: NodeBuffer, values: NodeBuffer, count: number, dictionaryKeyCallbacks: NodeBuffer, dictionaryValueCallbacks: NodeBuffer): NodeBuffer;
		getTypeID(type: NodeBuffer): number;
		stringGetCString(theString: NodeBuffer, buffer: NodeBuffer, bufferSize: number, encoding: number): boolean;
		stringGetLength(theString: NodeBuffer): number;
		dictionaryGetCount(theDict: NodeBuffer): number;
		createCFString(str: string): NodeBuffer;
		dictToPlistEncoding(dict: { [key: string]: {} }, format: number): NodeBuffer;
		dictFromPlistEncoding(str: NodeBuffer): NodeBuffer;
		dictionaryGetTypeID(): number;
		stringGetTypeID(): number;
		dataGetTypeID(): number;
		numberGetTypeID(): number;
		booleanGetTypeID(): number;
		arrayGetTypeID(): number;
		dateGetTypeID(): number;
		setGetTypeID(): number;
		dictionaryGetKeysAndValues(dictionary: NodeBuffer, keys: NodeBuffer, values: NodeBuffer): void;
		dataCreate(allocator: NodeBuffer, data: NodeBuffer, length: number): any;
		cfTypeFrom(value: IDictionary<any>): NodeBuffer;
		cfTypeTo(cfDictionary: NodeBuffer): IDictionary<any>;
	}

	interface IMobileDevice {
		deviceNotificationSubscribe(notificationCallback: NodeBuffer, p1: number, p2: number, context: any, callbackSignature: NodeBuffer): number;
		deviceCopyDeviceIdentifier(devicePointer: NodeBuffer): NodeBuffer;
		deviceCopyValue(devicePointer: NodeBuffer, domain: NodeBuffer, name: NodeBuffer): NodeBuffer;
		deviceConnect(devicePointer: NodeBuffer): number;
		deviceIsPaired(devicePointer: NodeBuffer): number;
		devicePair(devicePointer: NodeBuffer): number;
		deviceValidatePairing(devicePointer: NodeBuffer): number;
		deviceStartSession(devicePointer: NodeBuffer): number;
		deviceStopSession(devicePointer: NodeBuffer): number;
		deviceDisconnect(devicePointer: NodeBuffer): number;
		deviceStartService(devicePointer: NodeBuffer, serviceName: NodeBuffer, socketNumber: NodeBuffer): number;
		deviceTransferApplication(service: number, packageFile: NodeBuffer, options: NodeBuffer, installationCallback: NodeBuffer): number;
		deviceInstallApplication(service: number, packageFile: NodeBuffer, options: NodeBuffer, installationCallback: NodeBuffer): number;
		deviceUninstallApplication(service: number, bundleId: NodeBuffer, options: NodeBuffer, callback: NodeBuffer): number;
		deviceStartHouseArrestService(devicePointer: NodeBuffer, bundleId: NodeBuffer, options: NodeBuffer, fdRef: NodeBuffer): number;
		deviceMountImage(devicePointer: NodeBuffer, imagePath: NodeBuffer, options: NodeBuffer, mountCallBack: NodeBuffer): number;
		deviceLookupApplications(devicePointer: NodeBuffer, appType: number, result: NodeBuffer): number;
		deviceGetInterfaceType(devicePointer: NodeBuffer): number;
		deviceGetConnectionId(devicePointer: NodeBuffer): number;
		afcConnectionOpen(service: number, timeout: number, afcConnection: NodeBuffer): number;
		afcConnectionClose(afcConnection: NodeBuffer): number;
		afcDirectoryCreate(afcConnection: NodeBuffer, path: string): number;
		afcFileInfoOpen(afcConnection: NodeBuffer, path: string, afcDirectory: NodeBuffer): number;
		afcFileRefOpen(afcConnection: NodeBuffer, path: string, mode: number, afcFileRef: NodeBuffer): number;
		afcFileRefClose(afcConnection: NodeBuffer, afcFileRef: number): number;
		afcFileRefWrite(afcConnection: NodeBuffer, afcFileRef: number, buffer: NodeBuffer, byteLength: number): number;
		afcFileRefRead(afcConnection: NodeBuffer, afcFileRef: number, buffer: NodeBuffer, byteLength: NodeBuffer): number;
		afcRemovePath(afcConnection: NodeBuffer, path: string): number;
		afcDirectoryOpen(afcConnection: NodeBuffer, path: string, afcDirectory: NodeBuffer): number;
		afcDirectoryRead(afcConnection: NodeBuffer, afcdirectory: NodeBuffer, name: NodeBuffer): number;
		afcDirectoryClose(afcConnection: NodeBuffer, afcdirectory: NodeBuffer): number;
		isDataReceivingCompleted(reply: IDictionary<any>): boolean;
		setLogLevel(logLevel: number): number;

		/**
		 * Connect to a port on iOS device connected over USB.
		 * @param connectionId Connection ID obtained throught IMobileDevice deviceGetConnectionId.
		 * @param port Port on the device to connect to. The native API expects it in big endian!
		 * @param socketRef Out param, reference to the socket file descriptor.
		 */
		uSBMuxConnectByPort(connectionId: number, port: number, socketRef: NodeBuffer): number;
	}

	interface IHouseArrestClient {
		getAfcClientForAppContainer(applicationIdentifier: string): Mobile.IAfcClient;
		closeSocket(): void;
	}

	interface IAfcClient {
		open(path: string, mode: string): Mobile.IAfcFile;
		transfer(localFilePath: string, devicePath: string): IFuture<void>;
		deleteFile(devicePath: string): void;
		mkdir(path: string): void;
		listDir(path: string): string[];
	}

	interface IAfcFile {
		write(buffer: any, byteLength?: any): boolean;
		read(len: number): any;
		close(): void;
	}

	interface ILocalToDevicePathData {
		getLocalPath(): string;
		getDevicePath(): string;
		getRelativeToProjectBasePath(): string;
	}

	interface ILocalToDevicePathDataFactory {
		create(fileName: string, localProjectRootPath: string, onDeviceFileName: string, deviceProjectRootPath: string): Mobile.ILocalToDevicePathData;
	}

	interface IiOSSocketResponseData {
		Status?: string;
		Error?: string;
		PercentComplete?: string;
		Complete?: boolean;
	}

	interface IiOSDeviceSocket {
		receiveMessage(): IFuture<IiOSSocketResponseData>;
		readSystemLog(action: (data: string) => void): void;
		sendMessage(message: { [key: string]: {} }, format?: number): void;
		sendMessage(message: string): void;
		sendAll?(data: NodeBuffer): void;
		receiveAll?(callback: (data: NodeBuffer) => void): void;
		exchange(message: IDictionary<any>): IFuture<IiOSSocketResponseData>;
		close(): void;
	}

	interface IGDBServer {
		run(argv: string[]): IFuture<void>;
		kill(argv: string[]): IFuture<void>;
		destroy(): void;
	}

	interface INotificationProxyClient {
		postNotification(notificationName: string): void;
		postNotificationAndAttachForData(notificationName: string): void;
		addObserver(name: string, callback: (_name: string) => void): any;
		removeObserver(name: string, callback: (_name: string) => void): void;
	}

	interface IPlatformCapabilities {
		wirelessDeploy?: boolean;
		cableDeploy: boolean;
		companion?: boolean;
		hostPlatformsForDeploy: string[];
	}

	interface IAvdInfo {
		target: string;
		targetNum: number;
		path: string;
		device?: string;
		name?: string;
		abi?: string;
		skin?: string;
		sdcard?: string;
	}

	interface IEmulatorPlatformServices {
		checkDependencies(): IFuture<void>;
		checkAvailability(dependsOnProject?: boolean): IFuture<void>;
		startEmulator(): IFuture<string>;
		runApplicationOnEmulator(app: string, emulatorOptions?: IEmulatorOptions): IFuture<any>;
		getEmulatorId(): IFuture<string>;
	}

	interface IAndroidEmulatorServices extends IEmulatorPlatformServices {
		getAllRunningEmulators(): IFuture<string[]>;
	}

	interface IiSimDevice {
		name: string;
		id: string;
		fullId: string;
		runtimeVersion: string;
		state?: string;
	}

	interface IiOSSimResolver {
		iOSSim: any;
		iOSSimPath: string;
	}

	interface IiOSSimulatorService extends IEmulatorPlatformServices {
		postDarwinNotification(notification: string): IFuture<void>;
	}

	interface IEmulatorSettingsService {
		canStart(platform: string): IFuture<boolean>;
		minVersion: number;
	}

	interface IEmulatorOptions {
		stderrFilePath?: string;
		stdoutFilePath?: string;
		appId?: string;
		args?: string;
		deviceType?: string;
		waitForDebugger?: boolean;
		captureStdin?: boolean;
	}

	interface IPlatformsCapabilities {
		getPlatformNames(): string[];
		getAllCapabilities(): IDictionary<Mobile.IPlatformCapabilities>;
	}

	interface IMobileHelper {
		platformNames: string[];
		isAndroidPlatform(platform: string): boolean;
		isiOSPlatform(platform: string): boolean;
		isWP8Platform(platform: string): boolean;
		normalizePlatformName(platform: string): string;
		isPlatformSupported(platform: string): boolean;
		validatePlatformName(platform: string): string;
		getPlatformCapabilities(platform: string): Mobile.IPlatformCapabilities;
		buildDevicePath(...args: string[]): string;
		correctDevicePath(filePath: string): string;
	}

	interface IDevicePlatformsConstants {
		iOS: string;
		Android: string;
		WP8: string;
	}

	interface IDeviceApplication {
		CFBundleExecutable: string;
		Path: string;
	}

	interface IiOSDeviceProductNameMapper {
		resolveProductName(deviceType: string): string;
	}

	interface IAndroidDeviceHashService {
		/**
		 * Returns the hash file path on device
		 */
		hashFileDevicePath: string;
		/**
		 * If hash file exists on device, read the hashes from the file and returns them as array
		 * If hash file doesn't exist on device, returns null
		 */
		getShasumsFromDevice(): IFuture<IStringDictionary>;
		/**
		 * Computes the shasums of localToDevicePaths and changes the content of hash file on device
		 */
		uploadHashFileToDevice(data: IStringDictionary | Mobile.ILocalToDevicePathData[]): IFuture<void>;
		/**
		 * Computes the shasums of localToDevicePaths and updates hash file on device
		 */
		updateHashes(localToDevicePaths: Mobile.ILocalToDevicePathData[]): IFuture<boolean>;
		/**
		 * Computes the shasums of localToDevicePaths and removes them from hash file on device
		 */
		removeHashes(localToDevicePaths: Mobile.ILocalToDevicePathData[]): IFuture<boolean>;

		/**
		 * Detects if there's hash file on the device for the specified device.
		 * @return {IFuture<boolean>} boolean True if file exists and false otherwise.
		 */
		doesShasumFileExistsOnDevice(): IFuture<boolean>;
	}

	/**
	 * Describes information for Android debug bridge error.
	 */
	interface IAndroidDebugBridgeError {
		/**
		 * Name of the error.
		 */
		name: string;

		/**
		 * Description of the error.
		 */
		description: string;

		/**
		 * Returned result code.
		 */
		resultCode: number;
	}

	/**
	 * Describes logic for handling Android debug bridge result.
	 */
	interface IAndroidDebugBridgeResultHandler {
		/**
		 * Checks the Android debug bridge result for errors.
		 * @param {string} adbResult The Android debug bridge result.
		 * @return {string} The errors found in the Android debug bridge result.
		 */
		checkForErrors(adbResult: any): IAndroidDebugBridgeError[];

		/**
		 * Handles the Android debug bridge result errors.
		 * @param {IAndroidDebugBridgeError[]} errors The Android debug bridge result errors.
		 * @return {void}.
		 */
		handleErrors(errors: IAndroidDebugBridgeError[]): void;
	}
}
