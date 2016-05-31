///<reference path="../../../.d.ts"/>
"use strict";

import {ApplicationManagerBase} from "../../application-manager-base";
import * as net from "net";
import * as ref from "ref";
import * as os from "os";
import {CoreTypes, GDBServer} from "./ios-core";
import * as iOSProxyServices from "./ios-proxy-services";

export class IOSApplicationManager extends ApplicationManagerBase {
	private uninstallApplicationCallbackPtr: NodeBuffer = null;
	private _gdbServer: Mobile.IGDBServer = null;
	private applicationsLiveSyncStatus: Mobile.IApplicationLiveSyncStatus[];

	constructor(protected $logger: ILogger,
		private device: Mobile.IiOSDevice,
		private devicePointer: NodeBuffer,
		private $childProcess: IChildProcess,
		private $coreFoundation: Mobile.ICoreFoundation,
		private $errors: IErrors,
		private $injector: IInjector,
		private $mobileDevice: Mobile.IMobileDevice,
		private $hostInfo: IHostInfo,
		private $staticConfig: Config.IStaticConfig,
		private $devicePlatformsConstants: Mobile.IDevicePlatformsConstants,
		private $options: ICommonOptions) {
			super($logger);
			this.uninstallApplicationCallbackPtr = CoreTypes.am_device_mount_image_callback.toPointer(IOSApplicationManager.uninstallCallback);
		}

	private static uninstallCallback(dictionary: NodeBuffer, user: NodeBuffer): void { /* intentionally empty body */ }

	private getInstallationProxy(): iOSProxyServices.InstallationProxyClient {
		return this.$injector.resolve(iOSProxyServices.InstallationProxyClient, { device: this.device });
	}

	public getInstalledApplications():  IFuture<string[]> {
		return (() => {
			return _(this.getApplicationsLiveSyncSupportedStatus().wait())
					.map(appLiveSyncStatus => appLiveSyncStatus.applicationIdentifier)
					.sortBy((identifier: string) => identifier.toLowerCase())
					.value();
		}).future<string[]>()();
	}

	public installApplication(packageFilePath: string): IFuture<void> {
		return (() => {
			let installationProxy = this.getInstallationProxy();
			try {
				installationProxy.deployApplication(packageFilePath).wait();
			} finally {
				installationProxy.closeSocket();
			}
		}).future<void>()();
	}

	public getApplicationsLiveSyncSupportedStatus(): IFuture<Mobile.IApplicationLiveSyncStatus[]> {
		return ((): Mobile.IApplicationLiveSyncStatus[] => {
			let installationProxy = this.getInstallationProxy();
			try {
				let result = installationProxy.sendMessage({
						"Command": "Browse",
						"ClientOptions": {
							"ApplicationType": "User",
							"ReturnAttributes": [
								"CFBundleIdentifier",
								"IceniumLiveSyncEnabled"
							]}
					}).wait();

				/*
					Sample Result:
					[{
						"Total": 13,
						"CurrentIndex": 0,
						"CurrentAmount": 10,
						"Status": "BrowsingApplications",
						"CurrentList": [
						{
							"CFBundleIdentifier": "com.ebay.redlaserproper"
						},
						{
							"CFBundleIdentifier": "com.apple.TestFlight"
						},
						{
							"IceniumLiveSyncEnabled": true,
							"CFBundleIdentifier": "com.telerik.TestSpecialChars"
						},
						{
							"CFBundleIdentifier": "com.telerik.PlatformCompanion"
						},
						{
							"IceniumLiveSyncEnabled": true,
							"CFBundleIdentifier": "com.telerik.KendoUITabStrip1"
						},
						{
							"IceniumLiveSyncEnabled": true,
							"CFBundleIdentifier": "com.telerik.myAppNative1"
						},
						{
							"CFBundleIdentifier": "com.ionic.viewapp"
						},
						{
							"IceniumLiveSyncEnabled": true,
							"CFBundleIdentifier": "com.telerik.samplepinchandzoom"
						},
						{
							"CFBundleIdentifier": "com.telerik.7e4c83f6-4e40-420f-a395-ab3cd9f77afd.AppManager"
						},
						{
							"IceniumLiveSyncEnabled": true,
							"CFBundleIdentifier": "com.telerik.sampleinappbrowser"
						}
						]
					},
					{
							"Total": 13,
							"CurrentIndex": 10,
							"CurrentAmount": 3,
							"Status": "BrowsingApplications",
							"CurrentList": [
							{
								"IceniumLiveSyncEnabled": true,
								"CFBundleIdentifier": "com.telerik.KendoUIBlank9"
							},
							{
								"IceniumLiveSyncEnabled": true,
								"CFBundleIdentifier": "com.telerik.Blank1"
							},
							{
								"IceniumLiveSyncEnabled": true,
								"CFBundleIdentifier": "com.telerik.samplecapture"
							}
							]
						}
					]
				*/

				this.$logger.trace("Result when getting applications for which LiveSync is enabled: ", JSON.stringify(result, null, 2));
				this.applicationsLiveSyncStatus = [];
				_.each(result, (singleResult: any) => {
					let currentList = _.map(singleResult.CurrentList, (app: any) => ({applicationIdentifier: app.CFBundleIdentifier, isLiveSyncSupported: app.IceniumLiveSyncEnabled }));
					this.applicationsLiveSyncStatus = this.applicationsLiveSyncStatus.concat(currentList);
				});

				return this.applicationsLiveSyncStatus;
			} finally {
				installationProxy.closeSocket();
			}
		}).future<Mobile.IApplicationLiveSyncStatus[]>()();
	}

	public isLiveSyncSupported(appIdentifier: string): IFuture<boolean> {
		return ((): boolean => {
			let selectedApplication = _.find(this.applicationsLiveSyncStatus, app => app.applicationIdentifier === appIdentifier);
			return !!selectedApplication && selectedApplication.isLiveSyncSupported;
		}).future<boolean>()();
	}

	public uninstallApplication(appIdentifier: string): IFuture<void> {
		return (() => {
			let afc = this.device.startService(iOSProxyServices.MobileServices.INSTALLATION_PROXY);
			try {
				let result = this.$mobileDevice.deviceUninstallApplication(afc, this.$coreFoundation.createCFString(appIdentifier), null, this.uninstallApplicationCallbackPtr);
				if(result) {
					this.$errors.failWithoutHelp("AMDeviceUninstallApplication returned '%d'.", result);
				}
			} catch(e) {
				this.$logger.trace(`Error while uninstalling application ${e}.`);
			}

			this.$logger.trace("Application %s has been uninstalled successfully.", appIdentifier);
		}).future<void>()();
	}

	public startApplication(appIdentifier: string): IFuture<void> {
		return (() => {
			if(this.$hostInfo.isWindows && !this.$staticConfig.enableDeviceRunCommandOnWindows) {
				this.$errors.fail("$%s device run command is not supported on Windows for iOS devices.", this.$staticConfig.CLIENT_NAME.toLowerCase());
			}

			this.validateApplicationId(appIdentifier);
			this.device.mountImage().wait();

			this.runApplicationCore(appIdentifier).wait();
			this.$logger.info(`Successfully run application ${appIdentifier} on device with ID ${ this.device.deviceInfo.identifier}.`);
		}).future<void>()();
	}

	public stopApplication(appIdentifier: string): IFuture<void> {
		let application = this.getApplicationById(appIdentifier);
		let gdbServer = this.createGdbServer();
		return gdbServer.kill([`${application.Path}`]);
	}

	public restartApplication(applicationId: string): IFuture<void> {
		return (() => {
			this.stopApplication(applicationId).wait();
			this.runApplicationCore(applicationId).wait();
		}).future<void>()();
	}

	public canStartApplication(): boolean {
		return this.$hostInfo.isDarwin || (this.$hostInfo.isWindows && this.$staticConfig.enableDeviceRunCommandOnWindows);
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
		};

		return this.device.tryExecuteFunction<IDictionary<Mobile.IDeviceApplication>>(func);
	}

	private validateApplicationId(appIdentifier: string): Mobile.IDeviceApplication {
		let applications = this.lookupApplications();
		let application = applications[appIdentifier];
		if(!application) {
			let sortedKeys = _.sortBy(_.keys(applications));
			this.$errors.failWithoutHelp("Invalid application id: %s. All available application ids are: %s%s ", appIdentifier, os.EOL, sortedKeys.join(os.EOL));
		}

		return application;
	}

	private runApplicationCore(appIdentifier: any) {
		if (this._gdbServer) {
			this._gdbServer.destroy();
			this._gdbServer = null;
		}

		let application = this.getApplicationById(appIdentifier);
		let gdbServer = this.createGdbServer();
		return gdbServer.run([`${application.Path}`]);
	}

	private createGdbServer(): Mobile.IGDBServer {
		if(!this._gdbServer) {
			let service = this.device.startService(iOSProxyServices.MobileServices.DEBUG_SERVER);
			let socket = this.$hostInfo.isWindows ? service :  new net.Socket({ fd: service });
			this._gdbServer = this.$injector.resolve(GDBServer, { socket: socket });
		}
		return this._gdbServer;
	}

	private getApplicationById(appIdentifier: string): Mobile.IDeviceApplication {
		return this.validateApplicationId(appIdentifier);
	}
}
