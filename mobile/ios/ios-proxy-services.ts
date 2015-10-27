///<reference path="../../.d.ts"/>
"use strict";
import ref = require("ref");
import * as path from "path";
import * as iOSCore from "./ios-core";
import * as helpers from "../../helpers";
import plistlib = require("plistlib");

export class MobileServices {
	public static APPLE_FILE_CONNECTION: string = "com.apple.afc";
	public static INSTALLATION_PROXY: string = "com.apple.mobile.installation_proxy";
	public static HOUSE_ARREST: string = "com.apple.mobile.house_arrest";
	public static NOTIFICATION_PROXY: string = "com.apple.mobile.notification_proxy";
	public static SYSLOG: string = "com.apple.syslog_relay";
	public static MOBILE_IMAGE_MOUNTER: string = "com.apple.mobile.mobile_image_mounter";
	public static DEBUG_SERVER: string = "com.apple.debugserver";
}

export class AfcFile implements Mobile.IAfcFile {
	private open: boolean = false;
	private afcFile: number;

	constructor(path: string,
		mode: string,
		private afcConnection: NodeBuffer,
		private $mobileDevice: Mobile.IMobileDevice,
		private $errors: IErrors) {
		let modeValue = 0;
		if (mode.indexOf("r") > -1) {
			modeValue = 0x1;
		}
		if (mode.indexOf("w") > -1) {
			modeValue = 0x2;
		}
		let afcFileRef = ref.alloc(ref.types.uint64);
		this.open = false;

		let result = this.$mobileDevice.afcFileRefOpen(afcConnection, path, modeValue, afcFileRef);
		if (result !== 0) {
			this.$errors.fail("Unable to open file reference: '%s' with path '%s", result, path);
		}

		this.afcFile = ref.deref(afcFileRef);
		if (this.afcFile === 0) {
			this.$errors.fail("Invalid file reference");
		}

		this.open = true;
	}

	public read(len: number): any {
		let readLengthRef = ref.alloc(iOSCore.CoreTypes.uintType, len);
		let data = new Buffer(len * iOSCore.CoreTypes.pointerSize);
		let result = this.$mobileDevice.afcFileRefRead(this.afcConnection, this.afcFile, data, readLengthRef);
		if(result !== 0) {
			this.$errors.fail("Unable to read data from file '%s'. Result is: '%s'", this.afcFile, result);
		}

		let readLength = readLengthRef.deref();
		return data.slice(0, readLength);
	}

	public write(buffer: any, byteLength?: any): boolean {
		let result = this.$mobileDevice.afcFileRefWrite(this.afcConnection, this.afcFile, buffer, byteLength);
		if (result !== 0) {
			this.$errors.fail("Unable to write to file: '%s'. Result is: '%s'", this.afcFile, result);
		}

		return true;
	}

	public close(): void {
		if (this.open) {
			let result = this.$mobileDevice.afcFileRefClose(this.afcConnection, this.afcFile);
			if (result !== 0) {
				this.$errors.fail("Unable to close afc file connection: '%s'. Result is: '%s'", this.afcFile, result);
			}
			this.open = false;
		}
	}

	get writable(): boolean {
		return true;
	}
}

export class AfcClient implements Mobile.IAfcClient {
	private afcConnection: NodeBuffer = null;

	constructor(private service: number,
		private $mobileDevice: Mobile.IMobileDevice,
		private $coreFoundation: Mobile.ICoreFoundation,
		private $fs: IFileSystem,
		private $errors: IErrors,
		private $logger: ILogger,
		private $injector: IInjector) {
		let afcConnection = ref.alloc(ref.refType(ref.types.void));
		let result = $mobileDevice.afcConnectionOpen(this.service, 0, afcConnection);
		if (result !== 0) {
			$errors.fail("Unable to open apple file connection: %s", result);
		}

		this.afcConnection = ref.deref(afcConnection);
	}

	public open(path: string, mode: string): Mobile.IAfcFile {
		return this.$injector.resolve(AfcFile, {path: path, mode: mode, afcConnection: this.afcConnection});
	}

	public mkdir(path: string) {
		let result = this.$mobileDevice.afcDirectoryCreate(this.afcConnection, path);
		if (result !== 0) {
			this.$errors.fail("Unable to make directory: %s. Result is %s", path, result);
		}
	}

	public listDir(path: string): string[] {
		let afcDirectoryRef = ref.alloc(ref.refType(ref.types.void));
		let result = this.$mobileDevice.afcDirectoryOpen(this.afcConnection, path, afcDirectoryRef);
		if (result !== 0) {
			this.$errors.fail("Unable to open AFC directory: '%s' %s ", path, result);
		}

		let afcDirectoryValue = ref.deref(afcDirectoryRef);
		let name = ref.alloc(ref.refType(ref.types.char));
		let entries: string[] = [];

		while (this.$mobileDevice.afcDirectoryRead(this.afcConnection, afcDirectoryValue, name) === 0) {
			let value = ref.deref(name);
			if (ref.address(value) === 0) {
				break;
			}
			let filePath = ref.readCString(value, 0);
			if (filePath !== "." && filePath !== "..") {
				entries.push(filePath);
			}
		}

		this.$mobileDevice.afcDirectoryClose(this.afcConnection, afcDirectoryValue);

		return entries;
	}

	public close(): void {
		let result = this.$mobileDevice.afcConnectionClose(this.afcConnection);
		if (result !== 0) {
			this.$errors.failWithoutHelp(`Unable to close apple file connection: ${result}`);
		}
	}

	public transferPackage(localFilePath: string, devicePath: string): IFuture<void> {
		return (() => {
			this.transfer(localFilePath, devicePath).wait();
		}).future<void>()();
	}

	public deleteFile(devicePath: string): void {
		let removeResult = this.$mobileDevice.afcRemovePath(this.afcConnection, devicePath);
		this.$logger.trace("Removing device file '%s', result: %s", devicePath, removeResult.toString());
	}

	public transfer(localFilePath: string, devicePath: string): IFuture<void> {
		return(() => {
			this.ensureDevicePathExist(path.dirname(devicePath));
			let reader = this.$fs.createReadStream(localFilePath);
			devicePath = helpers.fromWindowsRelativePathToUnix(devicePath);

			this.deleteFile(devicePath);

			let target = this.open(devicePath, "w");
			let localFilePathSize = this.$fs.getFileSize(localFilePath).wait();

			reader.on("data", (data: NodeBuffer) => {
				target.write(data, data.length);
				this.$logger.trace("transfer-> localFilePath: '%s', devicePath: '%s', localFilePathSize: '%s', transferred bytes: '%s'",
					localFilePath, devicePath, localFilePathSize.toString(), data.length.toString());
			})
			.on("error", (error: Error) => {
				this.$errors.fail(error);
			})
			.on("end", () => target.close());

			this.$fs.futureFromEvent(reader, "close").wait();

		}).future<void>()();
	}

	private ensureDevicePathExist(deviceDirPath: string): void {
		let filePathParts = deviceDirPath.split(path.sep);
		let currentDevicePath = "";

		filePathParts.forEach((filePathPart: string) => {
			if (filePathPart !== "") {
				currentDevicePath = helpers.fromWindowsRelativePathToUnix(path.join(currentDevicePath, filePathPart));
				this.mkdir(currentDevicePath);
			}
		});
	}
}

export class InstallationProxyClient {
	private plistService: Mobile.IiOSDeviceSocket = null;

	constructor(private device: Mobile.IiOSDevice,
		private $logger: ILogger,
		private $injector: IInjector) { }

	public deployApplication(packageFile: string) : IFuture<void>  {
		return(() => {
			let service = this.device.startService(MobileServices.APPLE_FILE_CONNECTION);
			let afcClient = this.$injector.resolve(AfcClient, {service: service});
			let devicePath = path.join("PublicStaging", path.basename(packageFile));

			afcClient.transferPackage(packageFile, devicePath).wait();
			this.plistService = this.$injector.resolve(iOSCore.PlistService, {service: this.device.startService(MobileServices.INSTALLATION_PROXY), format: iOSCore.CoreTypes.kCFPropertyListBinaryFormat_v1_0});

			this.plistService.sendMessage({
				Command: "Install",
				PackagePath: helpers.fromWindowsRelativePathToUnix(devicePath)
			});
			this.plistService.receiveMessage().wait();
			this.$logger.info("Successfully deployed on device %s", this.device.deviceInfo.identifier);
		}).future<void>()();
	}

	public closeSocket() {
		return this.plistService.close();
	}
}
$injector.register("installationProxyClient", InstallationProxyClient);

export class NotificationProxyClient implements Mobile.INotificationProxyClient {

	private plistService: Mobile.IiOSDeviceSocket = null;
	private observers: IDictionary<Array<Function>> = {};

	private buffer: string = "";

	constructor(private device: Mobile.IiOSDevice,
		private $injector: IInjector) { }

	public postNotification(notificationName: string): void {
		this.plistService = this.$injector.resolve(iOSCore.PlistService, { service: this.device.startService(MobileServices.NOTIFICATION_PROXY), format: iOSCore.CoreTypes.kCFPropertyListBinaryFormat_v1_0 });
		this.postNotificationCore(notificationName);
	}

	public postNotificationAndAttachForData(notificationName: string): void {
		this.openSocket();
		this.postNotificationCore(notificationName);
	}

	public addObserver(name: string, callback: (_name: string) => void): any {
		this.openSocket();

		let result = this.plistService.sendMessage({
			"Command": "ObserveNotification",
			"Name": name
		});

		let array = this.observers[name];
		if (!array) {
			array = new Array();
			this.observers[name] = array;
		}
		array.push(callback);

		return result;
	}

	public removeObserver(name: string, callback: (_name: string) => void): void {
		let array = this.observers[name];
		if (array) {
			let index = array.indexOf(callback);
			if (index !== -1) {
				array.splice(index, 1);
			}
		}
	}

	private openSocket() {
		if (!this.plistService) {
			this.plistService = this.$injector.resolve(iOSCore.PlistService, { service: this.device.startService(MobileServices.NOTIFICATION_PROXY), format: iOSCore.CoreTypes.kCFPropertyListBinaryFormat_v1_0 });
			if (this.plistService.receiveAll) {
				this.plistService.receiveAll(this.handleData.bind(this));
			}
		}
	}

	private handleData(data: NodeBuffer): void {
		this.buffer += data.toString();

		let PLIST_HEAD = "<plist";
		let PLIST_TAIL = "</plist>";

		let start = this.buffer.indexOf(PLIST_HEAD);
		let end = this.buffer.indexOf(PLIST_TAIL);

		while (start >= 0 && end >= 0) {
			let plist = this.buffer.substr(start, end + PLIST_TAIL.length);
			this.buffer = this.buffer.substr(end + PLIST_TAIL.length);

			plistlib.loadString(plist, (err: any, plist: any) => {
				if (!err && plist) {
					this.handlePlistNotification(plist);
				}
			});

			start = this.buffer.indexOf("<plist");
			end = this.buffer.indexOf("</plist>");
		}
	}

	private postNotificationCore(notificationName: string): void {
		this.plistService.sendMessage({
			"Command": "PostNotification",
			"Name": notificationName,
			"ClientOptions": ""
		});
	}

	public closeSocket() {
		this.plistService.close();
	}

	private handlePlistNotification(plist: any) {
		if (plist.type !== "dict") {
			return;
		}
		let value = plist.value;
		if (!value) {
			return;
		}
		let command = value["Command"];
		let name = value["Name"];
		if (command.type !== "string" || command.value !== "RelayNotification" || name.type !== "string") {
			return;
		}
		let notification = name.value;
		let observers = this.observers[notification];
		if (!observers) {
			return;
		}

		observers.forEach(observer => observer(notification));
	}
}

export class HouseArrestClient implements Mobile.IHouseArrestClient {
	private plistService: Mobile.IiOSDeviceSocket = null;
	private static PREDEFINED_ERRORS: IStringDictionary = {
		ApplicationLookupFailed: "Unable to find the application on a connected device. Ensure that the application is installed and try again."
	};

	constructor(private device: Mobile.IiOSDevice,
		private $injector: IInjector,
		private $errors: IErrors) {
	}

	private getAfcClientCore(command: string, applicationIdentifier: string): Mobile.IAfcClient {
		let service = this.device.startService(MobileServices.HOUSE_ARREST);
		this.plistService = this.$injector.resolve(iOSCore.PlistService, {service: service, format: iOSCore.CoreTypes.kCFPropertyListXMLFormat_v1_0});

		this.plistService.sendMessage({
			"Command": command,
			"Identifier": applicationIdentifier
		});

		let response = this.plistService.receiveMessage().wait();
		if(response.Error) {
			this.$errors.failWithoutHelp(HouseArrestClient.PREDEFINED_ERRORS[response.Error] || response.Error);
		}

		return this.$injector.resolve(AfcClient, {service: service});
	}

	public getAfcClientForAppContainer(applicationIdentifier: string): Mobile.IAfcClient {
		return this.getAfcClientCore("VendContainer", applicationIdentifier);
	}

	public closeSocket() {
		this.plistService.close();
	}
}

export class IOSSyslog {
	private plistService: Mobile.IiOSDeviceSocket;

	constructor(private device: Mobile.IiOSDevice,
		private $logger: ILogger,
		private $injector: IInjector,
		private $deviceLogProvider: Mobile.IDeviceLogProvider,
		private $devicePlatformsConstants: Mobile.IDevicePlatformsConstants) {
		this.plistService = this.$injector.resolve(iOSCore.PlistService, {service: this.device.startService(MobileServices.SYSLOG), format: undefined});
	}

	public read(): void {
		let printData = (data: string) => {
			this.$deviceLogProvider.logData(data, this.$devicePlatformsConstants.iOS, this.device.deviceInfo.identifier);
		};
		this.plistService.readSystemLog(printData);
	}
}
