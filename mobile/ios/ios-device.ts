///<reference path="../../.d.ts"/>
"use strict";

import * as net from "net";
import * as ref from "ref";
import * as path from "path";
import * as util from "util";
import {CoreTypes, PlistService} from "./ios-core";
import * as iOSProxyServices from "./ios-proxy-services";
import * as applicationManagerPath from "./ios-application-manager";
import * as fileSystemPath from "./ios-device-file-system";
import * as constants from "../constants";

export class IOSDevice implements Mobile.IiOSDevice {
	// iOS errors are described here with HEX representation
	// https://github.com/samdmarshall/SDMMobileDevice/blob/763fa8d5a3b72eea86bf854894f8c8bcf5676877/Framework/MobileDevice/Error/SDMMD_Error.h
	// We receive them as decimal values.
	private static IMAGE_ALREADY_MOUNTED_ERROR_CODE = 3892314230;
	private static INCOMPATIBLE_IMAGE_SIGNATURE_ERROR_CODE = 3892314163;
	private static INTERFACE_USB = 1;

	private mountImageCallbackPtr: NodeBuffer = null;

	public applicationManager: Mobile.IDeviceApplicationManager;
	public fileSystem: Mobile.IDeviceFileSystem;
	public deviceInfo: Mobile.IDeviceInfo;

	constructor(private devicePointer: NodeBuffer,
		private $childProcess: IChildProcess,
		private $coreFoundation: Mobile.ICoreFoundation,
		private $errors: IErrors,
		private $fs: IFileSystem,
		private $injector: IInjector,
		private $logger: ILogger,
		private $mobileDevice: Mobile.IMobileDevice,
		private $devicePlatformsConstants: Mobile.IDevicePlatformsConstants,
		private $hostInfo: IHostInfo,
		private $options: ICommonOptions) {
			this.mountImageCallbackPtr = CoreTypes.am_device_mount_image_callback.toPointer(IOSDevice.mountImageCallback);

			this.applicationManager = this.$injector.resolve(applicationManagerPath.IOSApplicationManager, { device: this, devicePointer: this.devicePointer });
			this.fileSystem = this.$injector.resolve(fileSystemPath.IOSDeviceFileSystem, { device: this,  devicePointer: this.devicePointer });
			this.deviceInfo = <any>{
				identifier: this.$coreFoundation.convertCFStringToCString(this.$mobileDevice.deviceCopyDeviceIdentifier(this.devicePointer)),
				vendor: "Apple",
				platform: this.$devicePlatformsConstants.iOS,
				status: constants.CONNECTED_STATUS
			};

			this.deviceInfo.errorHelp = null;
			let productType = this.getValue("ProductType");
			this.deviceInfo.displayName = this.getValue("DeviceName") || productType;
			this.deviceInfo.model = productType;
			this.deviceInfo.version = this.getValue("ProductVersion");
			this.deviceInfo.color = this.getValue("DeviceColor");
	}

	private static mountImageCallback(dictionary: NodeBuffer, user: NodeBuffer): void {
		let coreFoundation: Mobile.ICoreFoundation = $injector.resolve("coreFoundation");
		let logger: ILogger = $injector.resolve("logger");

		let jsDictionary = coreFoundation.cfTypeTo(dictionary);
		logger.info("[Mounting] %s", jsDictionary["Status"]);
	}

	private getValue(value: string): string {
		try {
			this.connect();
			this.startSession();
			let cfValue =  this.$coreFoundation.createCFString(value);
			return this.$coreFoundation.convertCFStringToCString(this.$mobileDevice.deviceCopyValue(this.devicePointer, null, cfValue));
		} catch (err) {
			this.deviceInfo.errorHelp = this.deviceInfo.errorHelp || err.message.replace(/ Result code is: \d+$/, "");
			this.$logger.trace(`Error while trying to get ${value} for iOS device. Error is: `, err);
		} finally {
			this.stopSession();
			this.disconnect();
		}

		return null;
	}

	private validateResult(result: number, error: string) {
		if (result !== 0) {
			this.deviceInfo.status = constants.UNREACHABLE_STATUS;
			this.$errors.fail(util.format("%s. Result code is: %s", error, result));
		}
	}

	private isPaired(): boolean {
		return this.$mobileDevice.deviceIsPaired(this.devicePointer) !== 0;
	}

	private pair(): number {
		let result = this.$mobileDevice.devicePair(this.devicePointer);
		this.validateResult(result, "Make sure you have trusted the computer from your device. If your phone is locked with a passcode, unlock then reconnect it");
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
		if(result > 0) {
			this.$logger.warn(`Unable to disconnect. Result is: ${result}`);
		}
	}

	private startSession() {
		let result = this.$mobileDevice.deviceStartSession(this.devicePointer);
		this.validateResult(result, "Unable to start session");
	}

	private stopSession() {
		let result = this.$mobileDevice.deviceStopSession(this.devicePointer);
		if(result > 0) {
			this.$logger.warn(`Unable to stop session. Result is: ${result}`);
		}
	}

	private getDeviceValue(value: string): string {
		let deviceCopyValue = this.$mobileDevice.deviceCopyValue(this.devicePointer, null, this.$coreFoundation.createCFString(value));
		return this.$coreFoundation.convertCFStringToCString(deviceCopyValue);
	}

	private findDeveloperDirectory(): IFuture<string> {
		return (() => {
			let childProcess = this.$childProcess.spawnFromEvent("xcode-select", ["-print-path"], "close").wait();
			return childProcess.stdout.trim();
		}).future<string>()();
	}

	public tryExecuteFunction<TResult>(func: () => TResult): TResult {
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
				this.$errors.fail("Unable to find device support path. Verify that you have installed sdk compatible with your device version.");
			}

			return supportPath.path;
		}).future<string>()();
	}

	public mountImage(): IFuture<void> {
		return (() => {
			let imagePath = this.$options.ddi;

			if(this.$hostInfo.isWindows) {
				if(!imagePath) {
					this.$errors.fail("On windows operating system you must specify the path to developer disk image using --ddi option");
				}

				let imageSignature = this.$fs.readFile(util.format("%s.signature", imagePath)).wait();
				let imageSize = this.$fs.getFsStats(imagePath).wait().size;

				let imageMounterService = this.startService(iOSProxyServices.MobileServices.MOBILE_IMAGE_MOUNTER);
				let plistService: Mobile.IiOSDeviceSocket = this.$injector.resolve(PlistService, { service: imageMounterService, format: CoreTypes.kCFPropertyListXMLFormat_v1_0 });
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
					imagePath = path.join(developerDiskImageDirectoryPath, "DeveloperDiskImage.dmg");
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
							this.$logger.warn("Unable to mount image %s on device %s.", imagePath, this.deviceInfo.identifier);
						} else {
							this.$errors.fail("Unable to mount image on device.");
						}
					}
				};

				this.tryExecuteFunction<void>(func);
			}
		}).future<void>()();
	}

	private getInterfaceType(): number {
		return this.$mobileDevice.deviceGetInterfaceType(this.devicePointer);
	}

	public startService(serviceName: string): number {
		let func = () => {
			let socket = ref.alloc("int");
			let result = this.$mobileDevice.deviceStartService(this.devicePointer, this.$coreFoundation.createCFString(serviceName), socket);
			this.validateResult(result, `Unable to start service ${serviceName}`);
			return ref.deref(socket);
		};

		return this.tryExecuteFunction<number>(func);
	}

	public deploy(packageFile: string, packageName: string): IFuture<void> {
		return this.applicationManager.reinstallApplication(packageName, packageFile);
	}

	public openDeviceLogStream() {
		if(this.deviceInfo.status !== constants.UNREACHABLE_STATUS) {
			let iOSSystemLog = this.$injector.resolve(iOSProxyServices.IOSSyslog, {device: this});
			iOSSystemLog.read();
		}
	}

	// This function works only on OSX
	public connectToPort(port: number): net.Socket {
		let interfaceType = this.getInterfaceType();
		if(interfaceType === IOSDevice.INTERFACE_USB) {
			let connectionId = this.$mobileDevice.deviceGetConnectionId(this.devicePointer);
			let socketRef = ref.alloc(CoreTypes.intType);

			this.$mobileDevice.uSBMuxConnectByPort(connectionId, this.htons(port), socketRef);
			let socketValue = socketRef.deref();

			let socket: net.Socket;
			if (socketValue < 0) {
				socket = new net.Socket();
				process.nextTick(() => socket.emit("error", new Error("USBMuxConnectByPort returned bad file descriptor")));
			} else {
				socket = new net.Socket({ fd: socketValue });
				process.nextTick(() => socket.emit("connect"));
			}

			return socket;
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
}
$injector.register("iOSDevice", IOSDevice);
