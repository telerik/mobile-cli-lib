///<reference path="../../.d.ts"/>

declare module Mobile {

	interface ISyncOptions {
		skipRefresh?: boolean;
	}

	interface IDevice {
		getIdentifier(): string;
		getInstalledApplications(): IFuture<string[]>;
		getDisplayName(): string;
		getModel(): string;
		getVersion(): string;
		getVendor(): string;
		getPlatform(): string;
		deploy(packageFile: string, packageName: string): IFuture<void>;
		sync(localToDevicePaths: ILocalToDevicePathData[], appIdentifier: IAppIdentifier, liveSyncUrl: string): IFuture<void>;
		sync(localToDevicePaths: ILocalToDevicePathData[], appIdentifier: IAppIdentifier, liveSyncUrl: string, options: ISyncOptions): IFuture<void>;
		openDeviceLogStream(): void;
		runApplication(applicationId: string): IFuture<void>;
		uninstallApplication(applicationId: string): IFuture<void>;
		listFiles(devicePath: string): IFuture<void>;
		getFile(deviceFilePath: string): IFuture<void>;
		putFile(localFilePath: string, deviceFilePath: string): IFuture<void>;
	}

	interface IAppIdentifier {
		appIdentifier: string;
		deviceProjectPath: string;
		liveSyncFormat: string;
		encodeLiveSyncHostUri(hostUri: string): string;
		isLiveSyncSupported(device: any): IFuture<boolean>;
		getLiveSyncNotSupportedError(device: any): string;
	}

	interface IAndroidDevice extends IDevice {
		debug(packageFile: string, packageName: string, debuggerSetup?: any): IFuture<void>;
	}

	interface IIOSDevice extends IDevice {
		startService(serviceName: string): number;
	}

	interface ILogcatHelper {
		start(deviceIdentifier: string, adbPath: string): any;
	}

	interface IDebugOnDeviceSetup {
		frontEndPath?: string;
	}

	interface IDeviceDiscovery {
		deviceFound: ISignal;
		deviceLost: ISignal;
		startLookingForDevices(): IFuture<void>;
	}

	interface IDevicesServicesInitializationOptions {
		platform?: string;
		deviceId?: string;
		skipInferPlatform?: boolean;
	}

	interface IDevicesServices {
		hasDevices: boolean;
		deviceCount: number;
		execute(action: (device: Mobile.IDevice) => IFuture<void>, canExecute?: (dev: Mobile.IDevice) => boolean, options?: {allowNoDevices?: boolean}): IFuture<void>;
		initialize(data: IDevicesServicesInitializationOptions): IFuture<void>;
		platform: string;
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
		dictToPlistEncoding(dict: {[key: string]: {}}, format: number): NodeBuffer;
		dictFromPlistEncoding(str: NodeBuffer): NodeBuffer;
		dictionaryGetTypeID(): number;
		stringGetTypeID(): number;
		dataGetTypeID():  number;
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
		afcFileRefOpen(afcConnection: NodeBuffer, path: string, mode: number, afcFileRef: NodeBuffer): number;
		afcFileRefClose(afcConnection: NodeBuffer, afcFileRef: number): number;
		afcFileRefWrite(afcConnection: NodeBuffer, afcFileRef: number, buffer: NodeBuffer, byteLength: number): number;
		afcFileRefRead(afcConnection: NodeBuffer, afcFileRef: number, buffer: NodeBuffer, byteLength: NodeBuffer): number;
		afcRemovePath(afcConnection: NodeBuffer, path: string): number;
		afcDirectoryOpen(afcConnection: NodeBuffer, path: string, afcDirectory: NodeBuffer): number;
		afcDirectoryRead(afcConnection: NodeBuffer, afcdirectory: NodeBuffer,  name: NodeBuffer): number;
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
		getAfcClientForAppDocuments(applicationIdentifier: string): Mobile.IAfcClient;
		getAfcClientForAppContainer(applicationIdentifier: string): Mobile.IAfcClient;
		closeSocket(): void;
	}

	interface IAfcClient {
		open(path: string, mode: string): Mobile.IAfcFile;
		transfer(localFilePath: string, devicePath: string): IFuture<void>;
		transferCollection(localToDevicePaths: Mobile.ILocalToDevicePathData[]): IFuture<void>;
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

	interface IiOSSocketResponseData {
		Status?: string;
		Error?: string;
		PercentComplete?: string;
		Complete?: boolean;
	}

	interface IiOSDeviceSocket {
		receiveMessage(): IFuture<IiOSSocketResponseData>;
		readSystemLog(action: (data: NodeBuffer) => void): void;
		sendMessage(message: {[key: string]: {}}, format?: number): void;
		sendMessage(message: string): void;
		sendAll? (data: NodeBuffer): void;
		receiveAll? (callback: (data: NodeBuffer) => void): void;
		exchange(message: IDictionary<any>): IFuture<IiOSSocketResponseData>;
		close(): void;
	}

	interface IGDBServer {
		run(argv: string[]): void;
	}

	interface INotificationProxyClient {
		postNotification(notificationName: string): void;
		postNotificationAndAttachForData(notificationName: string): void;
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
		startEmulator(app: string, emulatorOptions?: IEmulatorOptions): IFuture<void>;
	}

	interface IEmulatorSettingsService {
		canStart(platform: string): IFuture<boolean>;
		minVersion: number;
	}

	interface IEmulatorOptions {
		stderrFilePath?: string;
		stdoutFilePath?: string;
		appId?: string;
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
		generateLocalToDevicePathData(localPath: string, devicePath: string, relativeToProjectBasePath: string): Mobile.ILocalToDevicePathData;
	}

	interface IDevicePlatformsConstants {
		iOS: string;
		Android: string;
		WP8: string;
	}
}
