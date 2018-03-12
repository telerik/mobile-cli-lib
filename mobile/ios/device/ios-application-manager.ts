import { EOL } from "os";
import { hook } from "../../../helpers";
import { ApplicationManagerBase } from "../../application-manager-base";
import { cache } from "../../../decorators";

export class IOSApplicationManager extends ApplicationManagerBase {
	private applicationsLiveSyncInfos: Mobile.ILiveSyncApplicationInfo[];

	constructor(protected $logger: ILogger,
		protected $hooksService: IHooksService,
		private device: Mobile.IDevice,
		private $errors: IErrors,
		private $iOSNotificationService: IiOSNotificationService,
		private $hostInfo: IHostInfo,
		private $staticConfig: Config.IStaticConfig,
		private $iosDeviceOperations: IIOSDeviceOperations,
		private $options: ICommonOptions,
		private $deviceLogProvider: Mobile.IDeviceLogProvider) {
		super($logger, $hooksService);
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
		await this.$iosDeviceOperations.install(packageFilePath, [this.device.deviceInfo.identifier], (err: IOSDeviceLib.IDeviceError) => {
			this.$errors.failWithoutHelp(`Failed to install ${packageFilePath} on device with identifier ${err.deviceId}. Error is: ${err.message}`);
		});
	}

	public async getApplicationInfo(applicationIdentifier: string): Promise<Mobile.IApplicationInfo> {
		if (!this.applicationsLiveSyncInfos || !this.applicationsLiveSyncInfos.length) {
			await this.getApplicationsLiveSyncSupportedStatus();
		}

		return _.find(this.applicationsLiveSyncInfos, app => app.applicationIdentifier === applicationIdentifier);
	}

	public async getApplicationsLiveSyncSupportedStatus(): Promise<Mobile.ILiveSyncApplicationInfo[]> {
		const deviceIdentifier = this.device.deviceInfo.identifier;
		const applicationsOnDeviceInfo = _.first((await this.$iosDeviceOperations.apps([deviceIdentifier]))[deviceIdentifier]);
		const applicationsOnDevice = applicationsOnDeviceInfo ? applicationsOnDeviceInfo.response : [];
		this.$logger.trace("Result when getting applications for which LiveSync is enabled: ", JSON.stringify(applicationsOnDevice, null, 2));

		this.applicationsLiveSyncInfos = _.map(applicationsOnDevice, app => ({
			applicationIdentifier: app.CFBundleIdentifier,
			isLiveSyncSupported: app.IceniumLiveSyncEnabled,
			configuration: app.configuration,
			deviceIdentifier: this.device.deviceInfo.identifier
		}));

		return this.applicationsLiveSyncInfos;
	}

	public async isLiveSyncSupported(appIdentifier: string): Promise<boolean> {
		if (!this.applicationsLiveSyncInfos || !this.applicationsLiveSyncInfos.length) {
			await this.getApplicationsLiveSyncSupportedStatus();
		}

		const selectedApplication = _.find(this.applicationsLiveSyncInfos, app => app.applicationIdentifier === appIdentifier);
		return !!selectedApplication && selectedApplication.isLiveSyncSupported;
	}

	public async uninstallApplication(appIdentifier: string): Promise<void> {
		await this.$iosDeviceOperations.uninstall(appIdentifier, [this.device.deviceInfo.identifier], (err: IOSDeviceLib.IDeviceError) => {
			this.$logger.warn(`Failed to uninstall ${appIdentifier} on device with identifier ${err.deviceId}`);
		});

		this.$logger.trace("Application %s has been uninstalled successfully.", appIdentifier);
	}

	public async startApplication(appData: Mobile.IApplicationData): Promise<void> {
		const { appId: appIdentifier, projectName } = appData;
		if (!await this.isApplicationInstalled(appIdentifier)) {
			this.$errors.failWithoutHelp("Invalid application id: %s. All available application ids are: %s%s ", appIdentifier, EOL, this.applicationsLiveSyncInfos.join(EOL));
		}

		this.$deviceLogProvider.setProjectNameForDevice(this.device.deviceInfo.identifier, projectName);
		await this.runApplicationCore(appIdentifier);

		this.$logger.info(`Successfully run application ${appIdentifier} on device with ID ${this.device.deviceInfo.identifier}.`);
	}

	public async stopApplication(appData: Mobile.IApplicationData): Promise<void> {
		const { appId } = appData;

		const action = () => this.$iosDeviceOperations.stop([{ deviceId: this.device.deviceInfo.identifier, ddi: this.$options.ddi, appId }]);

		try {
			await action();
		} catch (err) {
			this.$logger.trace(`Error when trying to stop application ${appId} on device ${this.device.deviceInfo.identifier}: ${err}. Retrying stop operation.`);
			await action();
		}
	}

	public async restartApplication(appData: Mobile.IApplicationData): Promise<void> {
		try {
			await this.stopApplication(appData);
			await this.runApplicationCore(appData.appId);
		} catch (err) {
			await this.$iOSNotificationService.postNotification(this.device.deviceInfo.identifier, `${appData.appId}:NativeScript.LiveSync.RestartApplication`);
			throw err;
		}
	}

	private async runApplicationCore(appIdentifier: string): Promise<void> {
		await this.$iosDeviceOperations.start([{ deviceId: this.device.deviceInfo.identifier, appId: appIdentifier, ddi: this.$options.ddi }]);
		if (!this.$options.justlaunch) {
			await this.startDeviceLog();
		}
	}

	@cache()
	private async startDeviceLog(): Promise<void> {
		await this.device.openDeviceLogStream();
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
}
