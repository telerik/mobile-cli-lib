import { EOL } from "os";
import { hook } from "../../../helpers";
import { ApplicationManagerBase } from "../../application-manager-base";

export class IOSApplicationManager extends ApplicationManagerBase {
	private applicationsLiveSyncInfos: Mobile.ILiveSyncApplicationInfo[];

	constructor(protected $logger: ILogger,
		protected $hooksService: IHooksService,
		private device: Mobile.IDevice,
		private $errors: IErrors,
		private $hostInfo: IHostInfo,
		private $staticConfig: Config.IStaticConfig,
		private $iosDeviceOperations: IIOSDeviceOperations,
		private $options: ICommonOptions) {
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

		let selectedApplication = _.find(this.applicationsLiveSyncInfos, app => app.applicationIdentifier === appIdentifier);
		return !!selectedApplication && selectedApplication.isLiveSyncSupported;
	}

	public async uninstallApplication(appIdentifier: string): Promise<void> {
		await this.$iosDeviceOperations.uninstall(appIdentifier, [this.device.deviceInfo.identifier], (err: IOSDeviceLib.IDeviceError) => {
			this.$logger.warn(`Failed to uninstall ${appIdentifier} on device with identifier ${err.deviceId}`);
		});

		this.$logger.trace("Application %s has been uninstalled successfully.", appIdentifier);
	}

	public async startApplication(appIdentifier: string): Promise<void> {
		if (this.$hostInfo.isWindows && !this.$staticConfig.enableDeviceRunCommandOnWindows) {
			this.$errors.fail("$%s device run command is not supported on Windows for iOS devices.", this.$staticConfig.CLIENT_NAME.toLowerCase());
		}

		if (!await this.isApplicationInstalled(appIdentifier)) {
			this.$errors.failWithoutHelp("Invalid application id: %s. All available application ids are: %s%s ", appIdentifier, EOL, this.applicationsLiveSyncInfos.join(EOL));
		}

		await this.runApplicationCore(appIdentifier);

		this.$logger.info(`Successfully run application ${appIdentifier} on device with ID ${this.device.deviceInfo.identifier}.`);
	}

	public async stopApplication(appIdentifier: string): Promise<void> {
		await this.$iosDeviceOperations.stop([{ deviceId: this.device.deviceInfo.identifier, ddi: this.$options.ddi, appId: appIdentifier }]);
	}

	public async restartApplication(applicationId: string): Promise<void> {
		await this.stopApplication(applicationId);
		await this.runApplicationCore(applicationId);
	}

	private async runApplicationCore(appIdentifier: string): Promise<void> {
		await this.$iosDeviceOperations.start([{ deviceId: this.device.deviceInfo.identifier, appId: appIdentifier, ddi: this.$options.ddi }]);
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
