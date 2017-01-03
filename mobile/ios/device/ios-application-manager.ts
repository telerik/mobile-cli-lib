import * as net from "net";
import * as ref from "ref";
import * as os from "os";
import * as iOSProxyServices from "./ios-proxy-services";
import { hook } from "../../../helpers";
import { ApplicationManagerBase } from "../../application-manager-base";
import { CoreTypes, GDBServer } from "./ios-core";

export class IOSApplicationManager extends ApplicationManagerBase {
	private uninstallApplicationCallbackPtr: NodeBuffer = null;
	private _gdbServer: Mobile.IGDBServer = null;
	private applicationsLiveSyncInfos: Mobile.ILiveSyncApplicationInfo[];

	constructor(protected $logger: ILogger,
		protected $hooksService: IHooksService,
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
		private $processService: IProcessService,
		private $options: ICommonOptions) {
		super($logger, $hooksService);
		this.uninstallApplicationCallbackPtr = CoreTypes.am_device_mount_image_callback.toPointer(IOSApplicationManager.uninstallCallback);
	}

	private static uninstallCallback(dictionary: NodeBuffer, user: NodeBuffer): void { /* intentionally empty body */ }

	private getInstallationProxy(): iOSProxyServices.InstallationProxyClient {
		return this.$injector.resolve(iOSProxyServices.InstallationProxyClient, { device: this.device });
	}

	public async getInstalledApplications(): Promise<string[]> {
		const applicationsLiveSyncStatus = await this.getApplicationsLiveSyncSupportedStatus();

		return _(applicationsLiveSyncStatus)
			.map(appLiveSyncStatus => appLiveSyncStatus.applicationIdentifier)
			.sortBy((identifier: string) => identifier.toLowerCase())
			.value();
	}

	@hook('install')
	public async installApplication(packageFilePath: string): Promise<void> {
		let installationProxy = this.getInstallationProxy();

		try {
			await installationProxy.deployApplication(packageFilePath);
		} finally {
			installationProxy.closeSocket();
		}
	}

	public async getApplicationInfo(applicationIdentifier: string): Promise<Mobile.IApplicationInfo> {
		if (!this.applicationsLiveSyncInfos || !this.applicationsLiveSyncInfos.length) {
			await this.getApplicationsLiveSyncSupportedStatus();
		}

		return _.find(this.applicationsLiveSyncInfos, app => app.applicationIdentifier === applicationIdentifier);
	}

	public async getApplicationsLiveSyncSupportedStatus(): Promise<Mobile.ILiveSyncApplicationInfo[]> {
		let installationProxy = this.getInstallationProxy();
		try {
			let result = await installationProxy.sendMessage({
				"Command": "Browse",
				"ClientOptions": {
					"ApplicationType": "User",
					"ReturnAttributes": [
						"CFBundleIdentifier",
						"IceniumLiveSyncEnabled",
						"configuration"
					]
				}
			});

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
						"CFBundleIdentifier": "com.telerik.myAppNative1",
						"configuration": "live"
					},
					{
						"CFBundleIdentifier": "com.ionic.viewapp"
					},
					{
						"IceniumLiveSyncEnabled": true,
						"CFBundleIdentifier": "com.telerik.samplepinchandzoom",
						"configuration": "test"
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
			this.applicationsLiveSyncInfos = [];
			_.each(result, (singleResult: any) => {
				let currentList = _.map(singleResult.CurrentList, (app: any) => ({
					applicationIdentifier: app.CFBundleIdentifier,
					isLiveSyncSupported: app.IceniumLiveSyncEnabled,
					configuration: app.configuration,
					deviceIdentifier: this.device.deviceInfo.identifier
				}));
				this.applicationsLiveSyncInfos = this.applicationsLiveSyncInfos.concat(currentList);
			});

			return this.applicationsLiveSyncInfos;
		} finally {
			installationProxy.closeSocket();
		}
	}

	public async isLiveSyncSupported(appIdentifier: string): Promise<boolean> {
		if (!this.applicationsLiveSyncInfos || !this.applicationsLiveSyncInfos.length) {
			await this.getApplicationsLiveSyncSupportedStatus();
		}

		let selectedApplication = _.find(this.applicationsLiveSyncInfos, app => app.applicationIdentifier === appIdentifier);
		return !!selectedApplication && selectedApplication.isLiveSyncSupported;
	}

	public async uninstallApplication(appIdentifier: string): Promise<void> {
		let afc = this.device.startService(iOSProxyServices.MobileServices.INSTALLATION_PROXY);
		try {
			let result = this.$mobileDevice.deviceUninstallApplication(afc, this.$coreFoundation.createCFString(appIdentifier), null, this.uninstallApplicationCallbackPtr);
			if (result) {
				this.$errors.failWithoutHelp("AMDeviceUninstallApplication returned '%d'.", result);
			}
		} catch (e) {
			this.$logger.trace(`Error while uninstalling application ${e}.`);
		}

		this.$logger.trace("Application %s has been uninstalled successfully.", appIdentifier);
	}

	public async startApplication(appIdentifier: string): Promise<void> {
		if (this.$hostInfo.isWindows && !this.$staticConfig.enableDeviceRunCommandOnWindows) {
			this.$errors.fail("$%s device run command is not supported on Windows for iOS devices.", this.$staticConfig.CLIENT_NAME.toLowerCase());
		}

		this.validateApplicationId(appIdentifier);
		await this.device.mountImage();

		await this.runApplicationCore(appIdentifier);
		this.$logger.info(`Successfully run application ${appIdentifier} on device with ID ${this.device.deviceInfo.identifier}.`);
	}

	public async stopApplication(appIdentifier: string): Promise<void> {
		let application = this.getApplicationById(appIdentifier);
		let gdbServer = this.createGdbServer(this.device.deviceInfo.identifier);
		return gdbServer.kill([`${application.Path}`]);
	}

	public async restartApplication(applicationId: string): Promise<void> {
		await this.stopApplication(applicationId);
		await this.runApplicationCore(applicationId);
	}

	public canStartApplication(): boolean {
		return this.$hostInfo.isDarwin || (this.$hostInfo.isWindows && this.$staticConfig.enableDeviceRunCommandOnWindows);
	}

	public getDebuggableApps(): Promise<Mobile.IDeviceApplicationInformation[]> {
		// Implement when we can find debuggable applications for iOS.
		return Promise.resolve([]);
	}

	public getDebuggableAppViews(appIdentifiers: string[]): Promise<IDictionary<Mobile.IDebugWebViewInfo[]>> {
		// Implement when we can find debuggable applications for iOS.
		return Promise.resolve(null);
	}

	private lookupApplications(): IDictionary<Mobile.IDeviceApplication> {
		let func = () => {
			let dictionaryPointer = ref.alloc(CoreTypes.cfDictionaryRef);
			let result = this.$mobileDevice.deviceLookupApplications(this.devicePointer, 0, dictionaryPointer);
			if (result) {
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
		if (!application) {
			let sortedKeys = _.sortBy(_.keys(applications));
			this.$errors.failWithoutHelp("Invalid application id: %s. All available application ids are: %s%s ", appIdentifier, os.EOL, sortedKeys.join(os.EOL));
		}

		return application;
	}

	private runApplicationCore(appIdentifier: any) {
		this.destroyGdbServer();
		let application = this.getApplicationById(appIdentifier);
		let gdbServer = this.createGdbServer(this.device.deviceInfo.identifier);
		return gdbServer.run([`${application.Path}`]);
	}

	private createGdbServer(deviceIdentifier: string): Mobile.IGDBServer {
		if (!this._gdbServer) {
			let service = this.device.startService(iOSProxyServices.MobileServices.DEBUG_SERVER);
			let socket = this.$hostInfo.isWindows ? service : new net.Socket({ fd: service });
			this._gdbServer = this.$injector.resolve(GDBServer, { socket: socket, deviceIdentifier: deviceIdentifier });
			this.$processService.attachToProcessExitSignals(this, this.destroyGdbServer);
		}
		return this._gdbServer;
	}

	private destroyGdbServer() {
		if (this._gdbServer) {
			this._gdbServer.destroy();
			this._gdbServer = null;
		}
	}

	private getApplicationById(appIdentifier: string): Mobile.IDeviceApplication {
		return this.validateApplicationId(appIdentifier);
	}
}
