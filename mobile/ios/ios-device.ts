///<reference path="../../../.d.ts"/>
"use strict";

import Future = require("fibers/future");
import net = require("net");
import ref = require("ref");
import os = require("os");
import path = require("path");
import util = require("util");

import iosCore = require("./ios-core");
import iOSProxyServices = require("./ios-proxy-services");
import helpers = require("./../../helpers");

let CoreTypes = iosCore.CoreTypes;

export class IOSDevice implements Mobile.IIOSDevice {
	private static IMAGE_ALREADY_MOUNTED_ERROR_CODE = 3892314230;
	private static INCOMPATIBLE_IMAGE_SIGNATURE_ERROR_CODE = 3892314163;
	private static INTERFACE_USB = 1;

	private identifier: string = null;
	private voidPtr = ref.refType(ref.types.void);
	private mountImageCallbackPtr: NodeBuffer = null;
	private uninstallApplicationCallbackPtr: NodeBuffer = null;

	constructor(private devicePointer: NodeBuffer,
		private $childProcess: IChildProcess,
		private $coreFoundation: Mobile.ICoreFoundation,
		private $errors: IErrors,
		private $fs: IFileSystem,
		private $injector: IInjector,
		private $logger: ILogger,
		private $mobileDevice: Mobile.IMobileDevice,
		private $staticConfig: Config.IStaticConfig,
		private $devicePlatformsConstants: Mobile.IDevicePlatformsConstants,
		private $hostInfo: IHostInfo,
		private $options: IOptions) {
		this.mountImageCallbackPtr = CoreTypes.am_device_mount_image_callback.toPointer(IOSDevice.mountImageCallback);
		this.uninstallApplicationCallbackPtr = CoreTypes.am_device_mount_image_callback.toPointer(IOSDevice.uninstallCallback);
	}

	private static mountImageCallback(dictionary: NodeBuffer, user: NodeBuffer): void {
		let coreFoundation: Mobile.ICoreFoundation = $injector.resolve("coreFoundation");
		let logger: ILogger = $injector.resolve("logger");

		let jsDictionary = coreFoundation.cfTypeTo(dictionary);
		logger.info("[Mounting] %s", jsDictionary["Status"]);
	}

	private static uninstallCallback(dictionary: NodeBuffer, user: NodeBuffer): void {
		IOSDevice.showStatus("Uninstalling", dictionary);
	}

	private static showStatus(action: string, dictionary: NodeBuffer) {
		let coreFoundation: Mobile.ICoreFoundation = $injector.resolve("coreFoundation");
		let logger: ILogger = $injector.resolve("logger");

		let jsDictionary = coreFoundation.cfTypeTo(dictionary);
		let output = [util.format("[%s]", action)];

		let append = (value: string) => {
			if(jsDictionary[value]) {
				output.push(util.format("%s: %s", value, jsDictionary[value]));
			}
		};

		if(jsDictionary) {
			append("PercentComplete");
			append("Status");
			append("Path");
		}

		logger.info(output.join(" "));
	}

	public getPlatform(): string {
		return this.$devicePlatformsConstants.iOS;
	}

	public getIdentifier(): string {
		if (this.identifier == null) {
			this.identifier = this.$coreFoundation.convertCFStringToCString(this.$mobileDevice.deviceCopyDeviceIdentifier(this.devicePointer));
		}

		return this.identifier;
	}

	public getDisplayName(): string {
		return this.getValue("ProductType");
	}

	public getModel(): string {
		return this.getValue("ProductType");
	}

	public getVersion(): string {
		return this.getValue("ProductVersion");
	}

	public getVendor(): string {
		return "Apple";
	}

	private getValue(value: string): string {
		this.connect();
		this.startSession();
		try {
			let cfValue =  this.$coreFoundation.createCFString(value);
			return this.$coreFoundation.convertCFStringToCString(this.$mobileDevice.deviceCopyValue(this.devicePointer, null, cfValue));
		} finally {
			this.stopSession();
			this.disconnect();
		}
	}

	private validateResult(result: number, error: string) {
		if (result !== 0) {
			this.$errors.fail(util.format("%s. Result code is: %s", error, result));
		}
	}

	private isPaired(): boolean {
		return this.$mobileDevice.deviceIsPaired(this.devicePointer) != 0;
	}

	private pair(): number {
		let result = this.$mobileDevice.devicePair(this.devicePointer);
		this.validateResult(result, "If your phone is locked with a passcode, unlock then reconnect it");
		return result;
	}

	private validatePairing() : number{
		let result = this.$mobileDevice.deviceValidatePairing(this.devicePointer);
		this.validateResult(result, "Unable to validate pairing");
		return result;
	}

	private connect() : number {
		let result = this.$mobileDevice.deviceConnect(this.devicePointer);
		this.validateResult(result, "Unable to connect to device");

		if (!this.isPaired()) {
			this.pair();
		}

		return this.validatePairing();
	}

	private disconnect() {
		let result = this.$mobileDevice.deviceDisconnect(this.devicePointer);
		this.validateResult(result, "Unable to disconnect from device");
	}

	private startSession() {
		let result = this.$mobileDevice.deviceStartSession(this.devicePointer);
		this.validateResult(result, "Unable to start session");
	}

	private stopSession() {
		let result = this.$mobileDevice.deviceStopSession(this.devicePointer);
		this.validateResult(result, "Unable to stop session");
	}

	private getDeviceValue(value: string): string {
		let deviceCopyValue = this.$mobileDevice.deviceCopyValue(this.devicePointer, null, this.$coreFoundation.createCFString(value));
		return this.$coreFoundation.convertCFStringToCString(deviceCopyValue);
	}

	private lookupApplications(): IDictionary<any> {
		let func = () => {
			let dictionaryPointer = ref.alloc(CoreTypes.cfDictionaryRef);
			let result = this.$mobileDevice.deviceLookupApplications(this.devicePointer, 0, dictionaryPointer);
			if(result !== 0) {
				this.$errors.fail("Invalid result code %s from device lookup applications.", result);
			}
			let cfDictionary = dictionaryPointer.deref();
			let jsDictionary = this.$coreFoundation.cfTypeTo(cfDictionary);
			return jsDictionary;
		}

		return this.tryToExecuteFunction<IDictionary<any>>(func);
	}

	private findDeveloperDirectory(): IFuture<string> {
		return (() => {
			let childProcess = this.$childProcess.spawnFromEvent("xcode-select", ["-print-path"], "close").wait();
			return childProcess.stdout.trim();
		}).future<string>()();
	}

	private tryToExecuteFunction<TResult>(func: () => TResult): TResult {
		this.connect();
		try {
			this.startSession();
			try {
				return func.apply(this, []);
			} finally {
				this.stopSession();
			}
		} finally {
			this.disconnect();
		}
	}

	private findDeveloperDiskImageDirectoryPath(): IFuture<string> {
		return (() => {
			let developerDirectory = this.findDeveloperDirectory().wait();
			let buildVersion = this.getDeviceValue("BuildVersion");
			let productVersion = this.getDeviceValue("ProductVersion");
			let productVersionParts = productVersion.split(".");
			let productMajorVersion = productVersionParts[0];
			let productMinorVersion = productVersionParts[1];

			let developerDiskImagePath = path.join(developerDirectory, "Platforms", "iPhoneOS.platform", "DeviceSupport");
			let supportPaths = this.$fs.readDirectory(developerDiskImagePath).wait();

			let supportPath: any = null;

			_.each(supportPaths, (sp: string) => {
				let parts = sp.split(' ');
				let version = parts[0];
				let versionParts = version.split(".");

				let supportPathData = {
					version: version,
					majorVersion: versionParts[0],
					minorVersion: versionParts[1],
					build: parts.length > 1 ? parts[1].replace(/[()]/, () => "") : null,
					path: path.join(developerDiskImagePath, sp)
				};

				if(supportPathData.majorVersion === productMajorVersion) {
					if(!supportPath) {
						supportPath = supportPathData;
					} else {
						// is this better than the last match?
						if(supportPathData.minorVersion === productMinorVersion) {
							if(supportPathData.build === buildVersion) {
								// perfect match
								supportPath = supportPathData;
							} else {
								// we're still better than existing match
								if(supportPath.build !== supportPathData.build || supportPath.build === null) {
									supportPath = supportPathData;
								}
							}
						}
					}
				}
			});

			if(!supportPath) {
				this.$errors.fail("Unable to find device support path.");
			}

			return supportPath.path;
		}).future<string>()();
	}

	private mountImage(): IFuture<void> {
		return (() => {
			let imagePath = this.$options.ddi;

			if(this.$hostInfo.isWindows) {
				if(!imagePath) {
					this.$errors.fail("On windows operating system you must specify the path to developer disk image using --ddi option");
				}

				let imageSignature = this.$fs.readFile(util.format("%s.signature", imagePath)).wait();
				let imageSize = this.$fs.getFsStats(imagePath).wait().size;

				let imageMounterService = this.startService(iOSProxyServices.MobileServices.MOBILE_IMAGE_MOUNTER);
				let plistService: Mobile.IiOSDeviceSocket = this.$injector.resolve(iosCore.PlistService, { service: imageMounterService, format: CoreTypes.kCFPropertyListXMLFormat_v1_0 });
				let result = plistService.exchange({
					Command: "ReceiveBytes",
					ImageSize: imageSize,
					ImageType: "Developer",
					ImageSignature: imageSignature
				}).wait();

				if(result.Status === "ReceiveBytesAck") {
					let fileData = this.$fs.readFile(imagePath).wait();
					plistService.sendAll(fileData);
				} else {
					let afcService = this.startService(iOSProxyServices.MobileServices.APPLE_FILE_CONNECTION);
					let afcClient = this.$injector.resolve(iOSProxyServices.AfcClient, {service: afcService});
					afcClient.transfer(imagePath, "PublicStaging/staging.dimage").wait();
				}

				try {
					result = plistService.exchange({
						Command: "MountImage",
						ImageType: "Developer",
						ImageSignature: imageSignature,
						ImagePath: "/let/mobile/Media/PublicStaging/staging.dimage"
					}).wait();

					if(result.Error) {
						this.$errors.fail("Unable to mount image. %s", result.Error);
					}
					if(result.Status) {
						this.$logger.info("Mount image: %s", result.Status);
					}
				} finally {
					plistService.close();
				}
			} else {
				let func = () => {
					let developerDiskImageDirectoryPath = this.findDeveloperDiskImageDirectoryPath().wait();
					let imagePath = path.join(developerDiskImageDirectoryPath, "DeveloperDiskImage.dmg");
					this.$logger.info("Mounting %s", imagePath);

					let signature = this.$fs.readFile(util.format("%s.signature", imagePath)).wait();
					let cfImagePath = this.$coreFoundation.createCFString(imagePath);

					let cfOptions = this.$coreFoundation.cfTypeFrom({
						ImageType: "Developer",
						ImageSignature: signature
					});

					let result = this.$mobileDevice.deviceMountImage(this.devicePointer, cfImagePath, cfOptions, this.mountImageCallbackPtr);

					if (result !== 0 && result !== IOSDevice.IMAGE_ALREADY_MOUNTED_ERROR_CODE) { // 3892314230 - already mounted
						if(result === IOSDevice.INCOMPATIBLE_IMAGE_SIGNATURE_ERROR_CODE) { // 3892314163
							this.$logger.warn("Unable to mount image %s on device %s.", imagePath, this.identifier);
						} else {
							this.$errors.fail("Unable to mount image on device.");
						}
					}
				};

				this.tryToExecuteFunction<void>(func);
			}
		}).future<void>()();
	}

	private getInterfaceType(): number {
		return this.$mobileDevice.deviceGetInterfaceType(this.devicePointer);
	}

	private startHouseArrestService(bundleId: string): number {
		let func = () => {
			let fdRef = ref.alloc("int");
			let result = this.$mobileDevice.deviceStartHouseArrestService(this.devicePointer, this.$coreFoundation.createCFString(bundleId), null, fdRef);
			let fd = fdRef.deref();

			if(result !== 0) {
				this.$errors.fail("AMDeviceStartHouseArrestService returned %s", result);
			}

			return fd;
		};

		return this.tryToExecuteFunction<number>(func);
	}

	public startService(serviceName: string): number {
		let func = () => {
			let socket = ref.alloc("int");
			let result = this.$mobileDevice.deviceStartService(this.devicePointer, this.$coreFoundation.createCFString(serviceName), socket);
			this.validateResult(result, "Unable to start service");
			return ref.deref(socket);
		}

		return this.tryToExecuteFunction<number>(func);
	}

	public deploy(packageFile: string, packageName: string): IFuture<void> {
		return (() => {
			let installationProxy = this.$injector.resolve(iOSProxyServices.InstallationProxyClient, {device: this });
			installationProxy.deployApplication(packageFile).wait();
			installationProxy.closeSocket();
		}).future<void>()();
	}

	public sync(localToDevicePaths: Mobile.ILocalToDevicePathData[], appIdentifier: Mobile.IAppIdentifier, liveSyncUrl: string, options: Mobile.ISyncOptions = {}): IFuture<void> {
		return(() => {
			//TODO: CloseSocket must be part of afcClient. Refactor it.
			let houseArrestClient: Mobile.IHouseArrestClient = this.$injector.resolve(iOSProxyServices.HouseArrestClient, {device: this});
			let afcClientForContainer = houseArrestClient.getAfcClientForAppContainer(appIdentifier.appIdentifier);
			afcClientForContainer.transferCollection(localToDevicePaths).wait();
			houseArrestClient.closeSocket();

			if (!this.$options.skipRefresh) {
				let afcClientForContainer = houseArrestClient.getAfcClientForAppContainer(appIdentifier.appIdentifier);
				afcClientForContainer.deleteFile("/Library/Preferences/ServerInfo.plist");
				houseArrestClient.closeSocket();

				let notificationProxyClient = this.$injector.resolve(iOSProxyServices.NotificationProxyClient, {device: this});
				notificationProxyClient.postNotification("com.telerik.app.refreshWebView");
				notificationProxyClient.closeSocket();
			}

			this.$logger.out("Successfully synced device with identifier '%s'", this.getIdentifier());

		}).future<void>()();
	}

	public openDeviceLogStream() {
		let iOSSystemLog = this.$injector.resolve(iOSProxyServices.IOSSyslog, {device: this});
		iOSSystemLog.read();
	}

	public getInstalledApplications():  IFuture<string[]> {
		return (() => {
			return _(this.lookupApplications()).keys().sortBy((identifier: string) => identifier.toLowerCase()).value();
		}).future<string[]>()();
	}

	public runApplication(applicationId: string): IFuture<void> {
		return (() => {
			if(this.$hostInfo.isWindows && (this.$staticConfig.enableDeviceRunCommandOnWindows === null || this.$staticConfig.enableDeviceRunCommandOnWindows === undefined)) {
				this.$errors.fail("$%s device run command is not supported on Windows for iOS devices.", this.$staticConfig.CLIENT_NAME.toLowerCase());
			}

			let applications = this.lookupApplications();
			let application = applications[applicationId];
			if(!application) {
				let sortedKeys = _.sortBy(_.keys(applications));
				this.$errors.fail("Invalid application id: %s. All available application ids are: %s%s ", applicationId, os.EOL, sortedKeys.join(os.EOL));
			}

			this.mountImage().wait();

			var service = this.startService(iOSProxyServices.MobileServices.DEBUG_SERVER);
			var socket = this.$hostInfo.isWindows ? service :  new net.Socket({ fd: service });
			var gdbServer = this.$injector.resolve(iosCore.GDBServer, { socket: socket });
			var executable = util.format("%s/%s", application.Path, application.CFBundleExecutable);

			gdbServer.run([executable]);

			this.$logger.info("Successfully run application %s on device with ID %s", applicationId, this.getIdentifier());
		}).future<void>()();
	}

	public uninstallApplication(applicationId: string): IFuture<void> {
		return (() => {
			let afc = this.startService(iOSProxyServices.MobileServices.INSTALLATION_PROXY);
			try {
				let result = this.$mobileDevice.deviceUninstallApplication(afc, this.$coreFoundation.createCFString(applicationId), null, this.uninstallApplicationCallbackPtr);
				if(result !== 0) {
					this.$errors.fail("AMDeviceUninstallApplication returned '%d'.", result);
				}
			} finally {
				//this.stopSession();
			}

			this.$logger.trace("Application %s has been uninstalled successfully.", applicationId);
		}).future<void>()();
	}

	public connectToPort(port: number): net.Socket {
		let interfaceType = this.getInterfaceType();
		if(interfaceType === IOSDevice.INTERFACE_USB) {
			let connectionId = this.$mobileDevice.deviceGetConnectionId(this.devicePointer);
			let socketRef = ref.alloc(CoreTypes.intType);

			this.$mobileDevice.uSBMuxConnectByPort(connectionId, this.htons(port), socketRef);
			let socketValue = socketRef.deref();

			return new net.Socket({ fd: socketValue });
		}

		return null;
	}

	/**
	 * Converts a little endian 16 bit int number to 16 bit int big endian number.
	 */
	private htons(port: number): number {
		let result =  (port & 0xff00) >> 8 | (port & 0x00ff) << 8;
		return result;
	}

	private resolveAfc(): Mobile.IAfcClient {
		let service = this.$options.app ? this.startHouseArrestService(this.$options.app) : this.startService(iOSProxyServices.MobileServices.APPLE_FILE_CONNECTION);
		let afcClient:Mobile.IAfcClient = this.$injector.resolve(iOSProxyServices.AfcClient, {service: service});
		return afcClient;
	}

	public getFile(deviceFilePath: string): IFuture<void> {
		return (() => {
			let afcClient = this.resolveAfc();
			let fileToRead = afcClient.open(deviceFilePath, "r");
			let fileToWrite = this.$options.file ? this.$fs.createWriteStream(this.$options.file) : process.stdout;
			let dataSizeToRead = 8192;
			let size = 0;

			while(true) {
				let data = fileToRead.read(dataSizeToRead);
				if(!data || data.length === 0) {
					break;
				}
				fileToWrite.write(data);
				size += data.length;
			}

			fileToRead.close();
			this.$logger.trace("%s bytes read from %s", size.toString(), deviceFilePath);

		}).future<void>()();
	}

	public putFile(localFilePath: string, deviceFilePath: string): IFuture<void> {
		let afcClient = this.resolveAfc();
		return afcClient.transfer(path.resolve(localFilePath), deviceFilePath);
	}

	public listFiles(devicePath: string): IFuture<void> {
		return (() => {
			if (!devicePath) {
				devicePath = ".";
			}

			this.$logger.info("Listing %s", devicePath);

			let afcClient = this.resolveAfc();

			let walk = (root:string, indent:number) => {
				this.$logger.info(util.format("%s %s", Array(indent).join(" "), root));
				let children:string[] = [];
				try {
					children = afcClient.listDir(root);
				} catch (e) {
					children = [];
				}

				_.each(children, (child:string) => {
					walk(root + "/" + child, indent + 1);
				});
			};

			walk(devicePath, 0);
		}).future<void>()();
	}
}
$injector.register("iOSDevice", IOSDevice);
