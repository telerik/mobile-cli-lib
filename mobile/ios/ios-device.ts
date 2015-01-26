///<reference path="../../../.d.ts"/>
"use strict";

import Future = require("fibers/future");
import ref = require("ref");
import os = require("os");
import path = require("path");
import util = require("util");

import iosCore = require("./ios-core");
import iOSProxyServices = require("./ios-proxy-services");
import MobileHelper = require("./../mobile-helper");
import helpers = require("./../../helpers");

var CoreTypes = iosCore.CoreTypes;

export class IOSDevice implements Mobile.IIOSDevice {
	private static IMAGE_ALREADY_MOUNTED_ERROR_CODE = 3892314230;

	private identifier: string = null;
	private voidPtr = ref.refType(ref.types.void);
	private mountImageCallbackPtr: NodeBuffer = null;

	constructor(private devicePointer: NodeBuffer,
		private $childProcess: IChildProcess,
		private $coreFoundation: Mobile.ICoreFoundation,
		private $errors: IErrors,
		private $fs: IFileSystem,
		private $injector: IInjector,
		private $logger: ILogger,
		private $mobileDevice: Mobile.IMobileDevice) {
		this.mountImageCallbackPtr = CoreTypes.am_device_mount_image_callback.toPointer(IOSDevice.mountImageCallback);
	}

	private static mountImageCallback(dictionary: NodeBuffer, user: NodeBuffer): void {
		var coreFoundation: Mobile.ICoreFoundation = $injector.resolve("coreFoundation");
		var logger: ILogger = $injector.resolve("logger");

		var jsDictionary = coreFoundation.cfTypeTo(dictionary);
		logger.info("[Mounting] %s", jsDictionary["Status"]);
	}

	public getPlatform(): string {
		return MobileHelper.DevicePlatforms[MobileHelper.DevicePlatforms.iOS];
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

	public getInstalledApplications(): IFuture<string[]> {
		throw new Error("Not implemented");
	}

	private getValue(value: string): string {
		this.connect();
		this.startSession();
		try {
			var cfValue =  this.$coreFoundation.createCFString(value);
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
		var result = this.$mobileDevice.devicePair(this.devicePointer);
		this.validateResult(result, "If your phone is locked with a passcode, unlock then reconnect it");
		return result;
	}

	private validatePairing() : number{
		var result = this.$mobileDevice.deviceValidatePairing(this.devicePointer);
		this.validateResult(result, "Unable to validate pairing");
		return result;
	}

	private connect() : number {
		var result = this.$mobileDevice.deviceConnect(this.devicePointer);
		this.validateResult(result, "Unable to connect to device");

		if (!this.isPaired()) {
			this.pair();
		}

		return this.validatePairing();
	}

	private disconnect() {
		var result = this.$mobileDevice.deviceDisconnect(this.devicePointer);
		this.validateResult(result, "Unable to disconnect from device");
	}

	private startSession() {
		var result = this.$mobileDevice.deviceStartSession(this.devicePointer);
		this.validateResult(result, "Unable to start session");
	}

	private stopSession() {
		var result = this.$mobileDevice.deviceStopSession(this.devicePointer);
		this.validateResult(result, "Unable to stop session");
	}

	private getDeviceValue(value: string): string {
		var deviceCopyValue = this.$mobileDevice.deviceCopyValue(this.devicePointer, null, this.$coreFoundation.createCFString(value));
		return this.$coreFoundation.convertCFStringToCString(deviceCopyValue);
	}

	private lookupApplications(): IDictionary<any> {
		var func = () => {
			var dictionaryPointer = ref.alloc(CoreTypes.cfDictionaryRef);
			var result = this.$mobileDevice.deviceLookupApplications(this.devicePointer, 0, dictionaryPointer);
			if(result !== 0) {
				this.$errors.fail("Invalid result code %s from device lookup applications.", result);
			}
			var cfDictionary = dictionaryPointer.deref();
			var jsDictionary = this.$coreFoundation.cfTypeTo(cfDictionary);
			return jsDictionary;
		}

		return this.tryToExecuteFunction<IDictionary<any>>(func);
	}

	private findDeveloperDirectory(): IFuture<string> {
		return (() => {
			var childProcess = this.$childProcess.spawnFromEvent("xcode-select", ["-print-path"], "close").wait();
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
			var developerDirectory = this.findDeveloperDirectory().wait();
			var buildVersion = this.getDeviceValue("BuildVersion");
			var productVersion = this.getDeviceValue("ProductVersion");
			var productVersionParts = productVersion.split(".");
			var productMajorVersion = productVersionParts[0];
			var productMinorVersion = productVersionParts[1];

			var developerDiskImagePath = path.join(developerDirectory, "Platforms", "iPhoneOS.platform", "DeviceSupport");
			var supportPaths = this.$fs.readDirectory(developerDiskImagePath).wait();

			var supportPath: any = null;

			_.each(supportPaths, (sp: string) => {
				var parts = sp.split(' ');
				var version = parts[0];
				var versionParts = version.split(".");

				var supportPathData = {
					version: version,
					majorVersion: versionParts[0],
					minorVersion: versionParts[1],
					build: parts.length > 1 ? parts[1].replace(/[()]/, () => "") : null,
					path: path.join(developerDiskImagePath, sp)
				}

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
				this.$errors.fail("Unable to find device support path");
			}

			return supportPath.path;
		}).future<string>()();
	}

	private mountImage(): void {
		var func = () => {
			var developerDiskImageDirectoryPath = this.findDeveloperDiskImageDirectoryPath().wait();
			var imagePath = path.join(developerDiskImageDirectoryPath, "DeveloperDiskImage.dmg");
			this.$logger.info("Mounting %s", imagePath);

			var signature = this.$fs.readFile(util.format("%s.signature", imagePath)).wait();
			var cfImagePath = this.$coreFoundation.createCFString(imagePath);

			var cfOptions = this.$coreFoundation.cfTypeFrom({
				ImageType: "Developer",
				ImageSignature: signature
			});

			var result = this.$mobileDevice.deviceMountImage(this.devicePointer, cfImagePath, cfOptions, this.mountImageCallbackPtr);

			if(result !== 0 && result !== IOSDevice.IMAGE_ALREADY_MOUNTED_ERROR_CODE) { // 3892314230 - already mounted
				this.$errors.fail("Unable to mount image on device.");
			}
		};

		this.tryToExecuteFunction<void>(func);
	}

	public startService(serviceName: string): number {
		var func = () => {
			var socket = ref.alloc("int");
			var result = this.$mobileDevice.deviceStartService(this.devicePointer, this.$coreFoundation.createCFString(serviceName), socket);
			this.validateResult(result, "Unable to start service");
			return ref.deref(socket);
		}

		return this.tryToExecuteFunction<number>(func);
	}

	public deploy(packageFile: string, packageName: string): IFuture<void> {
		return (() => {
			var installationProxy = this.$injector.resolve(iOSProxyServices.InstallationProxyClient, {device: this });
			installationProxy.deployApplication(packageFile).wait();
			installationProxy.closeSocket();
		}).future<void>()();
	}

    public debug(packageFile: string, packageName: string): IFuture<void> {
        return (() => {
            this.$errors.fail({formatStr:"this will come in a future version", suppressCommandHelp: true});
        }).future<void>()();
    }

	public sync(localToDevicePaths: Mobile.ILocalToDevicePathData[], appIdentifier: Mobile.IAppIdentifier, liveSyncUrl: string, options: Mobile.ISyncOptions = {}): IFuture<void> {
		return(() => {
			//TODO: CloseSocket must be part of afcClient. Refactor it.
			var houseArrestClient: Mobile.IHouseArrestClient = this.$injector.resolve(iOSProxyServices.HouseArrestClient, {device: this});
			var afcClientForAppDocuments = houseArrestClient.getAfcClientForAppDocuments(appIdentifier.appIdentifier);
			afcClientForAppDocuments.transferCollection(localToDevicePaths).wait();
			houseArrestClient.closeSocket();

			if (!options.skipRefresh) {
				var afcClientForContainer = houseArrestClient.getAfcClientForAppContainer(appIdentifier.appIdentifier);
				afcClientForContainer.deleteFile("/Library/Preferences/ServerInfo.plist");
				houseArrestClient.closeSocket();

				var notificationProxyClient = this.$injector.resolve(iOSProxyServices.NotificationProxyClient, {device: this});
				notificationProxyClient.postNotification("com.telerik.app.refreshWebView");
				notificationProxyClient.closeSocket();

			}

			this.$logger.out("Successfully synced device with identifier '%s'", this.getIdentifier());

		}).future<void>()();
	}

	public openDeviceLogStream() {
		var iOSSystemLog = this.$injector.resolve(iOSProxyServices.IOSSyslog, {device: this});
		iOSSystemLog.read();
	}

	public listApplications(): void {
		var applications = this.lookupApplications();
		_(_.sortBy(_.keys(applications))).each((bundleId: string) => this.$logger.info(bundleId));
	}

	public runApplication(applicationId: string): IFuture<void> {
		return (() => {
			var applications = this.lookupApplications();
			var application = applications[applicationId];
			if(!application) {
				var sortedKeys = _.sortBy(_.keys(applications));
				this.$errors.fail("Invalid application id: %s. All available application ids are: %s%s ", applicationId, os.EOL, sortedKeys.join(os.EOL));
			}

			this.mountImage();
			var gdbServer = this.$injector.resolve(iOSProxyServices.GDBServer, {device: this});
			var executable = util.format("%s/%s", application.Path, application.CFBundleExecutable);

			gdbServer.run([executable]);

		}).future<void>()();
	}
}

$injector.register("iOSDevice", IOSDevice);