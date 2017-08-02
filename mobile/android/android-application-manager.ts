import { EOL } from "os";
import { ApplicationManagerBase } from "../application-manager-base";
import { LiveSyncConstants, TARGET_FRAMEWORK_IDENTIFIERS } from "../../constants";
import { hook } from "../../helpers";

export class AndroidApplicationManager extends ApplicationManagerBase {

	constructor(private adb: Mobile.IDeviceAndroidDebugBridge,
		private identifier: string,
		private $options: ICommonOptions,
		private $logcatHelper: Mobile.ILogcatHelper,
		private $androidProcessService: Mobile.IAndroidProcessService,
		private $httpClient: Server.IHttpClient,
		private $deviceLogProvider: Mobile.IDeviceLogProvider,
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
	public async installApplication(packageFilePath: string, appIdentifier?: string): Promise<void> {
		if (appIdentifier) {
			let deviceRootPath = `/data/local/tmp/${appIdentifier}`;
			await this.adb.executeShellCommand(["rm", "-rf", deviceRootPath]);
		}

		return this.adb.executeCommand(["install", "-r", `${packageFilePath}`]);
	}

	public uninstallApplication(appIdentifier: string): Promise<void> {
		// Need to set the treatErrorsAsWarnings to true because when using tns run command if the application is not installed on the device it will throw error
		return this.adb.executeShellCommand(["pm", "uninstall", `${appIdentifier}`], { treatErrorsAsWarnings: true });
	}

	public async startApplication(appIdentifier: string): Promise<void> {
		const pmDumpOutput = await this.adb.executeShellCommand(["pm", "dump", appIdentifier, "|", "grep", "-A", "1", "MAIN"]);
		const fullActivityNameRegExp = this.getFullyQualifiedActivityRegex();
		const activityMatch = new RegExp(fullActivityNameRegExp, "m");
		const match = activityMatch.exec(pmDumpOutput);
		let possibleIdentifier = "";

		if(match && match.length > 0) {
			possibleIdentifier = match[0]
		}

		if (possibleIdentifier) {
			await this.adb.executeShellCommand(["am", "start", "-n", possibleIdentifier]);
		} else {
			this.$logger.trace(`Tried starting activity for: ${appIdentifier}, but failed`);
		}

		if (!this.$options.justlaunch) {
			const deviceIdentifier = this.identifier;
			const processIdentifier = await this.$androidProcessService.getAppProcessId(deviceIdentifier, appIdentifier);
			if (processIdentifier) {
				this.$deviceLogProvider.setApplicationPidForDevice(deviceIdentifier, processIdentifier);
			}

			await this.$logcatHelper.start(this.identifier);
		}
	}

	public stopApplication(appIdentifier: string): Promise<void> {
		return this.adb.executeShellCommand(["am", "force-stop", `${appIdentifier}`]);
	}

	public getApplicationInfo(applicationIdentifier: string): Promise<Mobile.IApplicationInfo> {
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

	public getDebuggableApps(): Promise<Mobile.IDeviceApplicationInformation[]> {
		return this.$androidProcessService.getDebuggableApps(this.identifier);
	}

	public async getDebuggableAppViews(appIdentifiers: string[]): Promise<IDictionary<Mobile.IDebugWebViewInfo[]>> {
		let mappedAppIdentifierPorts = await this.$androidProcessService.getMappedAbstractToTcpPorts(this.identifier, appIdentifiers, TARGET_FRAMEWORK_IDENTIFIERS.Cordova),
			applicationViews: IDictionary<Mobile.IDebugWebViewInfo[]> = {};

		await Promise.all(_.map(mappedAppIdentifierPorts, async (port: number, appIdentifier: string) => {
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
		}));

		return applicationViews;
	}

	public getFullyQualifiedActivityRegex(): RegExp {
		return /([A-Za-z]{1}[A-Za-z\d_]*\.)*[A-Za-z][A-Za-z\d_]*\/([a-z][a-z_0-9]*\.)*[A-Z_$]($[A-Z_$]|[$_\w_])*/;
	}
}
