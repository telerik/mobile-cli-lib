
declare module Mobile {
	interface ISyncOptions {
		skipRefresh?: boolean;
	}

	/**
	 * Describes available information for a device.
	 */
	interface IDeviceInfo extends IPlatform {
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

	interface IDeviceError extends Error, IDeviceIdentifier { }

	interface IDeviceIdentifier {
		deviceIdentifier: string;
	}

	interface IDevicesOperationError extends Error {
		allErrors: IDeviceError[];
	}

	interface IDevice {
		deviceInfo: Mobile.IDeviceInfo;
		applicationManager: Mobile.IDeviceApplicationManager;
		fileSystem: Mobile.IDeviceFileSystem;
		isEmulator: boolean;
		openDeviceLogStream(): Promise<void>;
		getApplicationInfo(applicationIdentifier: string): Promise<Mobile.IApplicationInfo>;

		/**
		 * Called when device is lost. Its purpose is to clean any resources used by the instance.
		 * @returns {void}
		 */
		detach?(): void;
	}

	interface IiOSDevice extends IDevice {
		connectToPort(port: number): Promise<any>;
	}

	interface IAndroidDevice extends IDevice {
		adb: Mobile.IDeviceAndroidDebugBridge;
		init(): Promise<void>;
	}

	interface IiOSSimulator extends IDevice { }

	interface IDeviceAppData extends IPlatform {
		appIdentifier: string;
		device: Mobile.IDevice;
		getDeviceProjectRootPath(): Promise<string>;
		deviceSyncZipPath?: string;
		isLiveSyncSupported(): Promise<boolean>;
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
		livesync(appIdentifier: string, liveSyncRoot: string, commands: string[]): Promise<void>;
		createCommandsFileOnDevice(commandsFileDevicePath: string, commands: string[]): Promise<void>;
	}

	interface ILogcatHelper {
		start(deviceIdentifier: string): Promise<void>;
		stop(deviceIdentifier: string): void;
	}

	/**
	 * Describes methods for providing device logs to a specific consumer.
	 */
	interface IDeviceLogProvider {
		/**
		 * Logs data in the specific way for the consumer.
		 * @param {string} line String from the device logs.
		 * @param {string} platform The platform of the device (for example iOS or Android).
		 * @param {string} deviceIdentifier The unique identifier of the device.
		 * @returns {void}
		 */
		logData(line: string, platform: string, deviceIdentifier: string): void;

		/**
		 * Sets the level of logging that will be used.
		 * @param {string} level The level of logs - could be INFO or FULL.
		 * @param {string} deviceIdentifier @optional The unique identifier of the device. When it is passed, only it's logging level is changed.
		 */
		setLogLevel(level: string, deviceIdentifier?: string): void;

		/**
		 * Sets the PID of the application on the specified device.
		 * @param {string} deviceIdentifier The unique identifier of the device.
		 * @param {string} pid The Process ID of the currently running application for which we need the logs.
		 */
		setApplicationPidForDevice(deviceIdentifier: string, pid: string): void;
	}

	/**
	 * Describes different options for filtering device logs.
	 */
	interface IDeviceLogOptions extends IStringDictionary {
		/**
		 * Process id of the application on the device.
		 */
		applicationPid: string;

		/**
		 * Selected log level for the current device. It can be INFO or FULL.
		 */
		logLevel: string;
	}

	/**
	 * Describes required methods for getting iOS Simulator's logs.
	 */
	interface IiOSSimulatorLogProvider {
		/**
		 * Starts the process for getting simulator logs and sends collected data to deviceLogProvider, which should decide how to show it to the user.
		 * @param {string} deviceIdentifier The unique identifier of the device.
		 */
		startLogProcess(deviceIdentifier: string): void;
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
		 * @param {string} pid @optional The application PID for this device.
		 * @param {string} logLevel @optional The logging level based on which input data will be filtered.
		 * @return {string} The filtered result based on the input or null when the input data shouldn't be shown.
		 */
		filterData(platform: string, data: string, pid?: string, logLevel?: string): string;
	}

	/**
	 * Describes filtering logic for specific platform (Android, iOS).
	 */
	interface IPlatformLogFilter {
		/**
		 * Filters passed string data based on the passed logging level.
		 * @param {string} data The string data that will be checked based on the logging level.
		 * @param {string} logLevel Selected logging level.
		 * @param {string} pid The Process ID of the currently running application for which we need the logs.
		 * @return {string} The filtered result based on the input or null when the input data shouldn't be shown.
		 */
		filterData(data: string, logLevel: string, pid: string): string;
	}

	interface ILoggingLevels {
		info: string;
		full: string;
	}

	interface IDeviceApplicationManager extends NodeJS.EventEmitter {
		getInstalledApplications(): Promise<string[]>;
		isApplicationInstalled(appIdentifier: string): Promise<boolean>;
		installApplication(packageFilePath: string, appIdentifier?: string): Promise<void>;
		uninstallApplication(appIdentifier: string): Promise<void>;
		reinstallApplication(appIdentifier: string, packageFilePath: string): Promise<void>;
		startApplication(appIdentifier: string): Promise<void>;
		stopApplication(appIdentifier: string, appName?: string): Promise<void>;
		restartApplication(appIdentifier: string, appName?: string): Promise<void>;
		canStartApplication(): boolean;
		checkForApplicationUpdates(): Promise<void>;
		isLiveSyncSupported(appIdentifier: string): Promise<boolean>;
		getApplicationInfo(applicationIdentifier: string): Promise<Mobile.IApplicationInfo>;
		tryStartApplication(appIdentifier: string): Promise<void>;
		getDebuggableApps(): Promise<Mobile.IDeviceApplicationInformation[]>;
		getDebuggableAppViews(appIdentifiers: string[]): Promise<IDictionary<Mobile.IDebugWebViewInfo[]>>;
	}

	/**
	 * Describes information about livesync in an application.
	 */
	interface ILiveSyncApplicationInfo extends IApplicationInfo {
		/**
		 * Whether LiveSync is supported
		 * @type {boolean}
		 */
		isLiveSyncSupported: boolean;
	}

	/**
	 * Describes information about an application.
	 */
	interface IApplicationInfo {
		/**
		 * Application's identifier
		 * @type {string}
		 */
		applicationIdentifier: string;

		/**
		 * Device's identifier
		 * @type {string}
		 */
		deviceIdentifier?: string;
		/**
		 * The configuration of the currently deployed application (e.g. debug, release, live, etc.)
		 * @type {string}
		 */
		configuration: string
	}

	interface IDeviceFileSystem {
		listFiles(devicePath: string, appIdentifier?: string): Promise<any>;
		getFile(deviceFilePath: string, appIdentifier: string, outputFilePath?: string): Promise<void>;
		putFile(localFilePath: string, deviceFilePath: string, appIdentifier: string): Promise<void>;
		deleteFile?(deviceFilePath: string, appIdentifier: string): Promise<void>;
		transferFiles(deviceAppData: Mobile.IDeviceAppData, localToDevicePaths: Mobile.ILocalToDevicePathData[]): Promise<void>;
		transferDirectory(deviceAppData: Mobile.IDeviceAppData, localToDevicePaths: Mobile.ILocalToDevicePathData[], projectFilesPath: string): Promise<Mobile.ILocalToDevicePathData[]>;
		transferFile?(localFilePath: string, deviceFilePath: string): Promise<void>;
		createFileOnDevice?(deviceFilePath: string, fileContent: string): Promise<void>;
	}

	interface IAndroidDebugBridgeCommandOptions {
		fromEvent?: string,
		returnChildProcess?: boolean,
		treatErrorsAsWarnings?: boolean,
		childProcessOptions?: any
	}

	interface IAndroidDebugBridge {
		executeCommand(args: string[], options?: IAndroidDebugBridgeCommandOptions): Promise<any>;
	}

	interface IDeviceAndroidDebugBridge extends IAndroidDebugBridge {
		executeShellCommand(args: string[], options?: IAndroidDebugBridgeCommandOptions): Promise<any>;
		sendBroadcastToDevice(action: string, extras?: IStringDictionary): Promise<number>;
	}

	interface IDebugOnDeviceSetup {
		frontEndPath?: string;
	}

	interface IDeviceDiscovery extends NodeJS.EventEmitter {
		startLookingForDevices(options?: IDeviceLookingOptions): Promise<void>;
		checkForDevices(): Promise<void>;
	}

	interface IAndroidDeviceDiscovery extends IDeviceDiscovery {
		ensureAdbServerStarted(): Promise<any>;
	}

	/**
	 * Describes options that can be passed to devices service's initialization method.
	 */
	interface IDevicesServicesInitializationOptions {
		/**
		 * The platform for which to initialize. If passed will detect only devices belonging to said platform.
		 */
		platform?: string;
		/**
		 * If passed will start an emulator if necesasry.
		 */
		emulator?: boolean;
		/**
		 * Specifies a device with which to work with.
		 */
		deviceId?: string;
		/**
		 * Specifies that platform should not be infered. That is to say that all devices will be detected regardless of platform and no errors will be thrown.
		 */
		skipInferPlatform?: boolean;
		/**
		 * If passed along with skipInferPlatform then the device detection interval will not be started but instead the currently attached devices will be detected.
		 */
		skipDeviceDetectionInterval?: boolean;
		/**
		 * Specifies whether we should skip the emulator starting.
		 */
		skipEmulatorStart?: boolean;
	}

	interface IDeviceActionResult<T> extends IDeviceIdentifier {
		result: T;
	}

	interface IDevicesService extends NodeJS.EventEmitter, IPlatform {
		hasDevices: boolean;
		deviceCount: number;

		/**
		 * Optionally starts emulator depending on the passed options.
		 * @param {IDevicesServicesInitializationOptions} data Defines wheather to start default or specific emulator.
		 * @return {Promise<void>}
		 */
		startEmulatorIfNecessary(data?: Mobile.IDevicesServicesInitializationOptions): Promise<void>;

		execute<T>(action: (device: Mobile.IDevice) => Promise<T>, canExecute?: (dev: Mobile.IDevice) => boolean, options?: { allowNoDevices?: boolean }): Promise<IDeviceActionResult<T>[]>;

		/**
		 * Initializes DevicesService, so after that device operations could be executed.
		 * @param {IDevicesServicesInitializationOptions} data Defines the options which will be used for whole devicesService.
		 * @return {Promise<void>}
		 */
		initialize(data?: IDevicesServicesInitializationOptions): Promise<void>;

		/**
		 * Add an IDeviceDiscovery instance which will from now on report devices. The instance should implement IDeviceDiscovery and raise "deviceFound" and "deviceLost" events.
		 * @param {IDeviceDiscovery} deviceDiscovery Instance, implementing IDeviceDiscovery and raising raise "deviceFound" and "deviceLost" events.
		 * @return {void}
		 */
		addDeviceDiscovery(deviceDiscovery: IDeviceDiscovery): void;
		getDevices(): Mobile.IDeviceInfo[];

		/**
		 * Gets device instance by specified identifier or number.
		 * @param {string} deviceOption The specified device identifier or number.
		 * @returns {Promise<Mobile.IDevice>} Instance of IDevice.
		 */
		getDevice(deviceOption: string): Promise<Mobile.IDevice>;
		getDevicesForPlatform(platform: string): Mobile.IDevice[];
		getDeviceInstances(): Mobile.IDevice[];
		getDeviceByDeviceOption(): Mobile.IDevice;
		isAndroidDevice(device: Mobile.IDevice): boolean;
		isiOSDevice(device: Mobile.IDevice): boolean;
		isiOSSimulator(device: Mobile.IDevice): boolean;
		isOnlyiOSSimultorRunning(): boolean;
		isAppInstalledOnDevices(deviceIdentifiers: string[], appIdentifier: string, framework: string): Promise<IAppInstalledInfo>[];
		setLogLevel(logLevel: string, deviceIdentifier?: string): void;
		deployOnDevices(deviceIdentifiers: string[], packageFile: string, packageName: string, framework: string): Promise<void>[];
		startDeviceDetectionInterval(): Promise<void>;
		getDeviceByIdentifier(identifier: string): Mobile.IDevice;
		mapAbstractToTcpPort(deviceIdentifier: string, appIdentifier: string, framework: string): Promise<string>;
		detectCurrentlyAttachedDevices(options?: Mobile.IDeviceLookingOptions): Promise<void>;
		startEmulator(platform?: string, emulatorImage?: string): Promise<void>;
		isCompanionAppInstalledOnDevices(deviceIdentifiers: string[], framework: string): Promise<IAppInstalledInfo>[];
		getDebuggableApps(deviceIdentifiers: string[]): Promise<Mobile.IDeviceApplicationInformation[]>[];
		getDebuggableViews(deviceIdentifier: string, appIdentifier: string): Promise<Mobile.IDebugWebViewInfo[]>;

		/**
		 * Returns all applications installed on the specified device.
		 * @param {string} deviceIdentifer The identifier of the device for which to get installed applications.
		 * @returns {Promise<string[]>} Array of all application identifiers of the apps installed on device.
		 */
		getInstalledApplications(deviceIdentifier: string): Promise<string[]>;
	}

	/**
	 * Describes methods for working with Android processes.
	 */
	interface IAndroidProcessService {
		/**
		 * Checks for available ports and forwards the current abstract port to one of the available ports.
		 * @param deviceIdentifier The identifier of the device.
		 * @param appIdentifier The identifier of the application.
		 * @param framework {string} The framework of the application. Could be Cordova or NativeScript.
		 * @return {string} Returns the tcp port number which is mapped to the abstract port.
		 */
		mapAbstractToTcpPort(deviceIdentifier: string, appIdentifier: string, framework: string): Promise<string>;

		/**
		 * Gets the applications which are available for debugging on the specified device.
		 * @param deviceIdentifier The identifier of the device.
		 * @return {Mobile.IDeviceApplicationInformation[]} Returns array of applications information for the applications which are available for debugging.
		 */
		getDebuggableApps(deviceIdentifier: string): Promise<Mobile.IDeviceApplicationInformation[]>;

		/**
		 * Gets all mapped abstract to tcp ports for specified device id and application identifiers.
		 * @param deviceIdentifier {string} The identifier of the device.
		 * @param appIdentifiers {string[]} Application identifiers that will be checked.
		 * @param framework {string} The framework of the application. Could be Cordova or NativeScript.
		 * @return {Promise<IDictionary<number>>} Dictionary, where the keys are app identifiers and the values are local ports.
		 */
		getMappedAbstractToTcpPorts(deviceIdentifier: string, appIdentifiers: string[], framework: string): Promise<IDictionary<number>>;

		/**
		 * Gets the PID of a running application.
		 * @param deviceIdentifier {string} The identifier of the device.
		 * @param appIdentifier The identifier of the application.
		 * @return {string} Returns the process id matching the application identifier in the device process list.
		 */
		getAppProcessId(deviceIdentifier: string, appIdentifier: string): Promise<string>;
	}

	/**
	 * Describes information for WebView that can be debugged.
	 */
	interface IDebugWebViewInfo {
		/**
		 * Short description of the view.
		 */
		description: string;

		/**
		 * Url to the devtools.
		 * @example http://chrome-devtools-frontend.appspot.com/serve_rev/@211d45a5b74b06d12bb016f3c4d54095faf2646f/inspector.html?ws=127.0.0.1:53213/devtools/page/4024
		 */
		devtoolsFrontendUrl: string;

		/**
		 * Unique identifier of the web view. Could be number or GUID.
		 * @example 4027
		 */
		id: string;

		/**
		 * Title of the WebView.
		 * @example https://bit.ly/12345V is not available
		 */
		title: string;

		/**
		 * Type of the WebView.
		 * @example page
		 */
		type: string;

		/**
		 * URL loaded in the view.
		 * @example https://bit.ly/12345V
		 */
		url: string;

		/**
		 * Debugger URL.
		 * @example ws://127.0.0.1:53213/devtools/page/4027
		 */
		webSocketDebuggerUrl: string;
	}

	interface IiTunesValidator {
		getError(): string;
	}

	interface ILocalToDevicePathData {
		getLocalPath(): string;
		getDevicePath(): string;
		getRelativeToProjectBasePath(): string;
		deviceProjectRootPath: string;
	}

	interface ILocalToDevicePathDataFactory {
		create(fileName: string, localProjectRootPath: string, onDeviceFileName: string, deviceProjectRootPath: string): Mobile.ILocalToDevicePathData;
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
		checkDependencies(): Promise<void>;

		/**
		 * Checks if the current system can start emulator of the specified mobile platform and throws error in case it cannot.
		 * @param {boolean} dependsOnProject Defines if the starting of emulator depends on the project configuration.
		 * @returns void
		 */
		checkAvailability(dependsOnProject?: boolean): void;

		startEmulator(emulatorImage?: string): Promise<string>
		runApplicationOnEmulator(app: string, emulatorOptions?: IEmulatorOptions): Promise<any>;
		getEmulatorId(): Promise<string>;
		getRunningEmulatorId(image: string): Promise<string>;
	}

	interface IAndroidEmulatorServices extends IEmulatorPlatformServices {
		getAllRunningEmulators(): Promise<string[]>;
		pathToEmulatorExecutable: string;
		getInfoFromAvd(avdName: string): Mobile.IAvdInfo;
		getAvds(): string[];
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
		postDarwinNotification(notification: string): Promise<void>;
	}

	interface IEmulatorSettingsService {
		/**
		 * Gives information if current project can be started in emulator.
		 * @param {string} platform The mobile platform of the emulator (android, ios, wp8).
		 * @returns {boolean} true in case the project can be started in emulator. In case not, the method will throw error.
		 */
		canStart(platform: string): boolean;
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
		skipInstall?: boolean;
	}

	interface IPlatformsCapabilities {
		getPlatformNames(): string[];
		getAllCapabilities(): IDictionary<Mobile.IPlatformCapabilities>;
	}

	//todo: plamen5kov: this is a duplicate of an interface (IEmulatorPlatformService) fix after 3.0-RC. nativescript-cli/lib/definitions/emulator-platform-service.d.ts
	interface IEmulatorImageService {
		listAvailableEmulators(platform: string): Promise<void>;
		getEmulatorInfo(platform: string, nameOfId: string): Promise<IEmulatorInfo>;
		getiOSEmulators(): Promise<IEmulatorInfo[]>;
		getAndroidEmulators(): IEmulatorInfo[];
	}

	//todo: plamen5kov: this is a duplicate of an interface (IEmulatorInfo) fix after 3.0-RC nativescript-cli/lib/definitions/emulator-platform-service.d.ts
	interface IEmulatorInfo extends IPlatform {
		name: string;
		version: string;
		id: string;
		type: string;
		isRunning?: boolean;
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

	interface IDeviceLookingOptions {
		shouldReturnImmediateResult: boolean;
		platform: string
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
		getShasumsFromDevice(): Promise<IStringDictionary>;
		/**
		 * Uploads updated shasums to hash file on device
		 */
		uploadHashFileToDevice(data: IStringDictionary): Promise<void>;
		/**
		 * Computes the shasums of localToDevicePaths and updates hash file on device
		 */
		updateHashes(localToDevicePaths: Mobile.ILocalToDevicePathData[]): Promise<boolean>;
		/**
		 * Computes the shasums of localToDevicePaths and removes them from hash file on device
		 */
		removeHashes(localToDevicePaths: Mobile.ILocalToDevicePathData[]): Promise<boolean>;

		/**
		 * Detects if there's hash file on the device for the specified device.
		 * @return {Promise<boolean>} boolean True if file exists and false otherwise.
		 */
		doesShasumFileExistsOnDevice(): Promise<boolean>;

		/**
		 * Generates hashes of specified localToDevicePaths by chunks and persists them in the passed @shasums argument.
		 * @param {Mobile.ILocalToDevicePathData[]} localToDevicePaths The localToDevicePaths objects for which the hashes should be generated.
		 * @param {IStringDicitionary} shasums Object in which the shasums will be persisted.
		 * @returns {Promise<string>[]} DevicePaths of all elements from the input localToDevicePaths.
		 */
		generateHashesFromLocalToDevicePaths(localToDevicePaths: Mobile.ILocalToDevicePathData[], shasums: IStringDictionary): Promise<string[]>;
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
		handleErrors(errors: IAndroidDebugBridgeError[], treatErrorsAsWarnings?: boolean): void;
	}

	/**
	 * Describes one row from Android's proc/net/tcp table.
	 */
	interface IAndroidPortInformation {
		/**
		 * Local address in format: IP-address:port both in hex format.
		 */
		localAddress: string;
		/**
		 * Remote address in format: IP-address:port both in hex format.
		 */
		remAddress: string;
		/**
		 * Process id.
		 */
		uid: number;
		/**
		 * Hex IP address.
		 */
		ipAddressHex: string;
		/**
		 * Decimal port number.
		 */
		number: number;
		/**
		 * Hex port number.
		 */
		numberHex: string;
	}

	/**
	 * Describes basic information about application on device.
	 */
	interface IDeviceApplicationInformationBase extends IDeviceIdentifier {
		/**
		 * The application identifier.
		 */
		appIdentifier: string;
	}

	/**
	 * Describes information about application on device.
	 */
	interface IDeviceApplicationInformation extends IDeviceApplicationInformationBase {
		/**
		 * The framework of the project (Cordova or NativeScript).
		 */
		framework: string;
	}
}

interface IIOSDeviceOperations extends IDisposable, NodeJS.EventEmitter {
	install(ipaPath: string, deviceIdentifiers: string[], errorHandler?: DeviceOperationErrorHandler): Promise<IOSDeviceResponse>;

	uninstall(appIdentifier: string, deviceIdentifiers: string[], errorHandler?: DeviceOperationErrorHandler): Promise<IOSDeviceResponse>;

	startLookingForDevices(deviceFoundCallback: DeviceInfoCallback, deviceLostCallback: DeviceInfoCallback, options?: Mobile.IDeviceLookingOptions): Promise<void>;

	startDeviceLog(deviceIdentifier: string): void;

	apps(deviceIdentifiers: string[], errorHandler?: DeviceOperationErrorHandler): Promise<IOSDeviceAppInfo>;

	listDirectory(listArray: IOSDeviceLib.IReadOperationData[], errorHandler?: DeviceOperationErrorHandler): Promise<IOSDeviceMultipleResponse>;

	readFiles(deviceFilePaths: IOSDeviceLib.IReadOperationData[], errorHandler?: DeviceOperationErrorHandler): Promise<IOSDeviceResponse>;

	downloadFiles(deviceFilePaths: IOSDeviceLib.IFileOperationData[], errorHandler?: DeviceOperationErrorHandler): Promise<IOSDeviceResponse>;

	uploadFiles(files: IOSDeviceLib.IUploadFilesData[], errorHandler?: DeviceOperationErrorHandler): Promise<IOSDeviceResponse>;

	deleteFiles(deleteArray: IOSDeviceLib.IDeleteFileData[], errorHandler?: DeviceOperationErrorHandler): Promise<IOSDeviceResponse>;

	start(startArray: IOSDeviceLib.IDdiApplicationData[], errorHandler?: DeviceOperationErrorHandler): Promise<IOSDeviceResponse>;

	stop(stopArray: IOSDeviceLib.IDdiApplicationData[], errorHandler?: DeviceOperationErrorHandler): Promise<IOSDeviceResponse>;

	postNotification(postNotificationArray: IOSDeviceLib.IPostNotificationData[], errorHandler?: DeviceOperationErrorHandler): Promise<IOSDeviceResponse>;

	awaitNotificationResponse(awaitNotificationResponseArray: IOSDeviceLib.IAwaitNotificatioNResponseData[], errorHandler?: DeviceOperationErrorHandler): Promise<IOSDeviceResponse>;

	connectToPort(connectToPortArray: IOSDeviceLib.IConnectToPortData[], errorHandler?: DeviceOperationErrorHandler): Promise<IDictionary<IOSDeviceLib.IConnectToPortResponse[]>>;

	setShouldDispose(shouldDispose: boolean): void;
}

type DeviceOperationErrorHandler = (err: IOSDeviceLib.IDeviceError) => void;

type DeviceInfoCallback = (deviceInfo: IOSDeviceLib.IDeviceActionInfo) => void;

type IOSDeviceResponse = IDictionary<IOSDeviceLib.IDeviceResponse[]>;

type IOSDeviceMultipleResponse = IDictionary<IOSDeviceLib.IDeviceMultipleResponse[]>;

type IOSDeviceAppInfo = IDictionary<IOSDeviceLib.IDeviceAppInfo[]>;

