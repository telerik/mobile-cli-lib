import { EOL } from "os";
import { ApplicationManagerBase } from "../application-manager-base";
import { LiveSyncConstants, TARGET_FRAMEWORK_IDENTIFIERS } from "../../constants";
import { hook } from "../../helpers";

export class AndroidApplicationManager extends ApplicationManagerBase {

	constructor(private adb: Mobile.IDeviceAndroidDebugBridge,
		private identifier: string,
		private $staticConfig: Config.IStaticConfig,
		private $options: ICommonOptions,
		private $logcatHelper: Mobile.ILogcatHelper,
		private $androidProcessService: Mobile.IAndroidProcessService,
		private $httpClient: Server.IHttpClient,
		$logger: ILogger,
		$hooksService: IHooksService) {
		super($logger, $hooksService);
	}

	public async getInstalledApplications(): Promise<string[]> {
		let result = await this.adb.executeShellCommand(["pm", "list", "packages"]) || "";
		let regex = /package:(.+)/;
		return result.split(EOL)
			.map((packageString: string) => {
				let match = packageString.match(regex);
				return match ? match[1] : null;
			})
			.filter((parsedPackage: string) => parsedPackage !== null);
	}

	@hook('install')
	public async installApplication(packageFilePath: string): Promise<void> {
		return this.adb.executeCommand(["install", "-r", `${packageFilePath}`]);
	}

	public async uninstallApplication(appIdentifier: string): Promise<void> {
		// Need to set the treatErrorsAsWarnings to true because when using tns run command if the application is not installed on the device it will throw error
		return this.adb.executeShellCommand(["pm", "uninstall", `${appIdentifier}`], { treatErrorsAsWarnings: true });
	}

	public async startApplication(appIdentifier: string, framework?: string): Promise<void> {
		this.adb.executeShellCommand(["monkey",
			"-p", appIdentifier,
			"-c", "android.intent.category.LAUNCHER",
			await "1"]);

		if (!this.$options.justlaunch) {
			this.$logcatHelper.start(this.identifier);
		}
	}

	public async stopApplication(appIdentifier: string): Promise<void> {
		return this.adb.executeShellCommand(["am", "force-stop", `${appIdentifier}`]);
	}

	public async getApplicationInfo(applicationIdentifier: string): Promise<Mobile.IApplicationInfo> {
		// This method is currently only used in the ios application managers. Configurations for Android are acquired through filesystem listing.
		return Promise.resolve(null);
	}

	public canStartApplication(): boolean {
		return true;
	}

	public async isLiveSyncSupported(appIdentifier: string): Promise<boolean> {
		let liveSyncVersion = await this.adb.sendBroadcastToDevice(LiveSyncConstants.CHECK_LIVESYNC_INTENT_NAME, { "app-id": appIdentifier });
		return liveSyncVersion === LiveSyncConstants.VERSION_2 || liveSyncVersion === LiveSyncConstants.VERSION_3;
	}

	public async getDebuggableApps(): Promise<Mobile.IDeviceApplicationInformation[]> {
		return this.$androidProcessService.getDebuggableApps(this.identifier);
	}

	public async getDebuggableAppViews(appIdentifiers: string[]): Promise<IDictionary<Mobile.IDebugWebViewInfo[]>> {
		let mappedAppIdentifierPorts = await this.$androidProcessService.getMappedAbstractToTcpPorts(this.identifier, appIdentifiers, TARGET_FRAMEWORK_IDENTIFIERS.Cordova),
			applicationViews: IDictionary<Mobile.IDebugWebViewInfo[]> = {};

		_.each(mappedAppIdentifierPorts, async (port: number, appIdentifier: string) => {
			applicationViews[appIdentifier] = [];
			let localAddress = `http://127.0.0.1:${port}/json`;

			try {
				if (port) {
					let apps = (await this.$httpClient.httpRequest(localAddress)).body;
					applicationViews[appIdentifier] = JSON.parse(apps);
				}
			} catch (err) {
				this.$logger.trace(`Error while checking ${localAddress}. Error is: ${err.message}`);
			}
		});

		return applicationViews;
	}
}
