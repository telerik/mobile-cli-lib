import { EOL } from "os";
import { ApplicationManagerBase } from "../application-manager-base";
import { LiveSyncConstants, TARGET_FRAMEWORK_IDENTIFIERS } from "../../constants";
import { hook } from "../../helpers";
import { cache } from "../../decorators";

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
		const result = await this.adb.executeShellCommand(["pm", "list", "packages"]) || "";
		const regex = /package:(.+)/;
		return result.split(EOL)
			.map((packageString: string) => {
				const match = packageString.match(regex);
				return match ? match[1] : null;
			})
			.filter((parsedPackage: string) => parsedPackage !== null);
	}

	@hook('install')
	public async installApplication(packageFilePath: string, appIdentifier?: string): Promise<void> {
		if (appIdentifier) {
			const deviceRootPath = `/data/local/tmp/${appIdentifier}`;
			await this.adb.executeShellCommand(["rm", "-rf", deviceRootPath]);
		}

		return this.adb.executeCommand(["install", "-r", `${packageFilePath}`]);
	}

	public uninstallApplication(appIdentifier: string): Promise<void> {
		// Need to set the treatErrorsAsWarnings to true because when using tns run command if the application is not installed on the device it will throw error
		return this.adb.executeShellCommand(["pm", "uninstall", `${appIdentifier}`], { treatErrorsAsWarnings: true });
	}

	public async startApplication(appIdentifier: string): Promise<void> {

		/*
		Example "pm dump <app_identifier> | grep -A 1 MAIN" output"
			android.intent.action.MAIN:
			3b2df03 org.nativescript.cliapp/com.tns.NativeScriptActivity filter 50dd82e
			Action: "android.intent.action.MAIN"
			Category: "android.intent.category.LAUNCHER"
			--
			intent={act=android.intent.action.MAIN cat=[android.intent.category.LAUNCHER] flg=0x10200000 cmp=org.nativescript.cliapp/com.tns.NativeScriptActivity}
			realActivity=org.nativescript.cliapp/com.tns.NativeScriptActivity
			--
			Intent { act=android.intent.action.MAIN cat=[android.intent.category.LAUNCHER] flg=0x10200000 cmp=org.nativescript.cliapp/com.tns.NativeScriptActivity }
			frontOfTask=true task=TaskRecord{fe592ac #449 A=org.nativescript.cliapp U=0 StackId=1 sz=1}
		*/
		const pmDumpOutput = await this.adb.executeShellCommand(["pm", "dump", appIdentifier, "|", "grep", "-A", "1", "MAIN"]);
		const activityMatch = this.getFullyQualifiedActivityRegex();
		const match = activityMatch.exec(pmDumpOutput);
		const possibleIdentifier = match && match[0];

		if (possibleIdentifier) {
			await this.adb.executeShellCommand(["am", "start", "-n", possibleIdentifier]);
		} else {
			this.$logger.trace(`Tried starting activity for: ${appIdentifier}, using activity manager but failed.`);
			await this.adb.executeShellCommand(["monkey", "-p", appIdentifier, "-c", "android.intent.category.LAUNCHER", "1"]);
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
		this.$logcatHelper.stop(this.identifier);
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
		const liveSyncVersion = await this.adb.sendBroadcastToDevice(LiveSyncConstants.CHECK_LIVESYNC_INTENT_NAME, { "app-id": appIdentifier });
		return liveSyncVersion === LiveSyncConstants.VERSION_2 || liveSyncVersion === LiveSyncConstants.VERSION_3;
	}

	public getDebuggableApps(): Promise<Mobile.IDeviceApplicationInformation[]> {
		return this.$androidProcessService.getDebuggableApps(this.identifier);
	}

	public async getDebuggableAppViews(appIdentifiers: string[]): Promise<IDictionary<Mobile.IDebugWebViewInfo[]>> {
		const mappedAppIdentifierPorts = await this.$androidProcessService.getMappedAbstractToTcpPorts(this.identifier, appIdentifiers, TARGET_FRAMEWORK_IDENTIFIERS.Cordova),
			applicationViews: IDictionary<Mobile.IDebugWebViewInfo[]> = {};

		await Promise.all(_.map(mappedAppIdentifierPorts, async (port: number, appIdentifier: string) => {
			applicationViews[appIdentifier] = [];
			const localAddress = `http://127.0.0.1:${port}/json`;

			try {
				if (port) {
					const apps = (await this.$httpClient.httpRequest(localAddress)).body;
					applicationViews[appIdentifier] = JSON.parse(apps);
				}
			} catch (err) {
				this.$logger.trace(`Error while checking ${localAddress}. Error is: ${err.message}`);
			}
		}));

		return applicationViews;
	}

	@cache()
	private getFullyQualifiedActivityRegex(): RegExp {
		const androidPackageName = "([A-Za-z]{1}[A-Za-z\\d_]*\\.)*[A-Za-z][A-Za-z\\d_]*";
		const packageActivitySeparator = "\\/";
		const fullJavaClassName = "([a-z][a-z_0-9]*\\.)*[A-Z_$]($[A-Z_$]|[$_\\w_])*";

		return new RegExp(`${androidPackageName}${packageActivitySeparator}${fullJavaClassName}`, `m`);
	}
}
