///<reference path="../../../.d.ts"/>
"use strict";

import net = require("net");
import ref = require("ref");
import os = require("os");

import iosCore = require("./ios-core");
let CoreTypes = iosCore.CoreTypes;
import iOSProxyServices = require("./ios-proxy-services");

export class IOSApplicationManager implements Mobile.IDeviceApplicationManager {
	private uninstallApplicationCallbackPtr: NodeBuffer = null;
	
	constructor(private device: Mobile.IiOSDevice,
		private devicePointer: NodeBuffer,
		private $childProcess: IChildProcess,
		private $coreFoundation: Mobile.ICoreFoundation,
		private $errors: IErrors,
		private $injector: IInjector,
		private $mobileDevice: Mobile.IMobileDevice,
		private $logger: ILogger,
		private $hostInfo: IHostInfo,
		private $staticConfig: IStaticConfig,
		private $devicePlatformsConstants: Mobile.IDevicePlatformsConstants) {
			this.uninstallApplicationCallbackPtr = CoreTypes.am_device_mount_image_callback.toPointer(IOSApplicationManager.uninstallCallback); 
		}
		
	private static uninstallCallback(dictionary: NodeBuffer, user: NodeBuffer): void { }
		
	public getInstalledApplications():  IFuture<string[]> {
		return (() => {
			return _(this.lookupApplications()).keys().sortBy((identifier: string) => identifier.toLowerCase()).value();
		}).future<string[]>()();
	}
	
	public installApplication(packageFilePath: string): IFuture<void> {
		return (() => {
			let installationProxy = this.$injector.resolve(iOSProxyServices.InstallationProxyClient, { device: this.device });
			installationProxy.deployApplication(packageFilePath).wait();
			installationProxy.closeSocket();
		}).future<void>()();
	}

	public uninstallApplication(applicationId: string): IFuture<void> {
		return (() => {
			let afc = this.device.startService(iOSProxyServices.MobileServices.INSTALLATION_PROXY);
			try {
				let result = this.$mobileDevice.deviceUninstallApplication(afc, this.$coreFoundation.createCFString(applicationId), null, this.uninstallApplicationCallbackPtr);
				if(result) {
					this.$errors.failWithoutHelp("AMDeviceUninstallApplication returned '%d'.", result);
				}
			} catch(e) {
				this.$logger.trace(`Error while uninstalling application ${e}.`);
			}

			this.$logger.trace("Application %s has been uninstalled successfully.", applicationId);
		}).future<void>()();
	}	
	
	public startApplication(applicationId: string): IFuture<void> {
		return (() => {
			if(this.$hostInfo.isWindows && !this.$staticConfig.enableDeviceRunCommandOnWindows) {
				this.$errors.fail("$%s device run command is not supported on Windows for iOS devices.", this.$staticConfig.CLIENT_NAME.toLowerCase());
			}
			
			this.validateApplicationId(applicationId);
			this.device.mountImage().wait();
			
			this.runApplicationCore(applicationId).wait();
			this.$logger.info(`Successfully run application ${applicationId} on device with ID ${ this.device.deviceInfo.identifier}.`);
		}).future<void>()();
	}
	
	public stopApplication(applicationId: string): IFuture<void> {
		let application = this.getApplicationById(applicationId);		
		let gdbServer = this.createGdbServer();
		return gdbServer.kill(application.CFBundleExecutable);
	}
	
	public restartApplication(applicationId: string): IFuture<void> {
		return (() => {
			// This must be executed in separate process because ddb sometimes fails and the cli crashes.
			this.$childProcess.exec(`${process.argv[0]} ${process.argv[1]} device stop ${applicationId} ${this.$devicePlatformsConstants.iOS}`).wait();
			this.runApplicationCore(applicationId).wait();
		}).future<void>()();
	}
	
	private lookupApplications(): IDictionary<Mobile.IDeviceApplication> {
		let func = () => {
			let dictionaryPointer = ref.alloc(CoreTypes.cfDictionaryRef);
			let result = this.$mobileDevice.deviceLookupApplications(this.devicePointer, 0, dictionaryPointer);
			if(result) {
				this.$errors.fail("Invalid result code %s from device lookup applications.", result);
			}
			let cfDictionary = dictionaryPointer.deref();
			let jsDictionary = this.$coreFoundation.cfTypeTo(cfDictionary);
			return jsDictionary;
		}

		return this.device.tryExecuteFunction<IDictionary<Mobile.IDeviceApplication>>(func);
	}
	
	private validateApplicationId(applicationId: string): Mobile.IDeviceApplication {
		let applications = this.lookupApplications();
		let application = applications[applicationId];
		if(!application) {
			let sortedKeys = _.sortBy(_.keys(applications));
			this.$errors.failWithoutHelp("Invalid application id: %s. All available application ids are: %s%s ", applicationId, os.EOL, sortedKeys.join(os.EOL));
		}
		
		return application;
	}
	
	private runApplicationCore(applicationId: any) {
		let application = this.getApplicationById(applicationId);
		let gdbServer = this.createGdbServer();
		return gdbServer.run([`${application.Path}/${application.CFBundleExecutable}`]);
	}
	
	private createGdbServer(): Mobile.IGDBServer {
		let service = this.device.startService(iOSProxyServices.MobileServices.DEBUG_SERVER);
		let socket = this.$hostInfo.isWindows ? service :  new net.Socket({ fd: service });			
		let gdbServer = this.$injector.resolve(iosCore.GDBServer, { socket: socket });
		
		return gdbServer;
	}
	
	private getApplicationById(applicationId: string): Mobile.IDeviceApplication {
		return this.validateApplicationId(applicationId);
	}
}