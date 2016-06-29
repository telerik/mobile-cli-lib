import {EOL} from "os";
import {ApplicationManagerBase} from "../application-manager-base";
import { LiveSyncConstants, startPackageActivityNames, TARGET_FRAMEWORK_IDENTIFIERS } from "../../mobile/constants";

export class AndroidApplicationManager extends ApplicationManagerBase {

	constructor(private adb: Mobile.IDeviceAndroidDebugBridge,
		private identifier: string,
		private $staticConfig: Config.IStaticConfig,
		private $options: ICommonOptions,
		private $logcatHelper: Mobile.ILogcatHelper,
		private $androidProcessService: Mobile.IAndroidProcessService,
		$logger: ILogger) {
		super($logger);
	}

	public getInstalledApplications(): IFuture<string[]> {
		return (() => {
			let result = this.adb.executeShellCommand(["pm", "list", "packages"]).wait() || "";
			let regex = /package:(.+)/;
			return result.split(EOL)
				.map((packageString: string) => {
					let match = packageString.match(regex);
					return match ? match[1] : null;
				})
				.filter((parsedPackage: string) => parsedPackage !== null);

		}).future<string[]>()();
	}

	public installApplication(packageFilePath: string): IFuture<void> {
		return this.adb.executeCommand(["install", "-r", `${packageFilePath}`]);
	}

	public uninstallApplication(appIdentifier: string): IFuture<void> {
		// Need to set the treatErrorsAsWarnings to true because when using tns run command if the application is not installed on the device it will throw error
		return this.adb.executeShellCommand(["pm", "uninstall", `${appIdentifier}`], { treatErrorsAsWarnings: true });
	}

	public startApplication(appIdentifier: string, framework?: string): IFuture<void> {
		return (() => {
			let startActivityName = this.getStartPackageActivity(framework);
			let defaultActivityNames = [startPackageActivityNames[TARGET_FRAMEWORK_IDENTIFIERS.Cordova.toLowerCase()],
				startPackageActivityNames[TARGET_FRAMEWORK_IDENTIFIERS.NativeScript.toLowerCase()]];

			let startActivityNames = startActivityName ? [startActivityName] : defaultActivityNames;

			_.each(startActivityNames, (activityName: string) => {
				this.adb.executeShellCommand(["am", "start",
					"-a", "android.intent.action.MAIN",
					"-n", `${appIdentifier}/${activityName}`,
					"-c", "android.intent.category.LAUNCHER"]).wait();
			});

			if (!this.$options.justlaunch) {
				this.$logcatHelper.start(this.identifier);
			}
		}).future<void>()();
	}

	public stopApplication(appIdentifier: string): IFuture<void> {
		return this.adb.executeShellCommand(["am", "force-stop", `${appIdentifier}`]);
	}

	public canStartApplication(): boolean {
		return true;
	}

	public isLiveSyncSupported(appIdentifier: string): IFuture<boolean> {
		return ((): boolean => {
			let liveSyncVersion = this.adb.sendBroadcastToDevice(LiveSyncConstants.CHECK_LIVESYNC_INTENT_NAME, { "app-id": appIdentifier }).wait();
			return liveSyncVersion === LiveSyncConstants.VERSION_2 || liveSyncVersion === LiveSyncConstants.VERSION_3;
		}).future<boolean>()();
	}

	public getDebuggableApps(): IFuture<Mobile.IAndroidApplicationInformation[]> {
		return this.$androidProcessService.getDebuggableApps(this.identifier);
	}

	private getStartPackageActivity(framework?: string): string {
		framework = framework || "";
		return startPackageActivityNames[framework.toLowerCase()] || this.$staticConfig.START_PACKAGE_ACTIVITY_NAME;
	}
}
