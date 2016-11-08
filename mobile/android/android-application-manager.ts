import {EOL} from "os";
import {ApplicationManagerBase} from "../application-manager-base";
import { LiveSyncConstants, TARGET_FRAMEWORK_IDENTIFIERS } from "../../constants";
import Future = require("fibers/future");

export class AndroidApplicationManager extends ApplicationManagerBase {

	constructor(private adb: Mobile.IDeviceAndroidDebugBridge,
		private identifier: string,
		private $staticConfig: Config.IStaticConfig,
		private $options: ICommonOptions,
		private $deviceLogService: IDeviceLogService,
		private $androidProcessService: Mobile.IAndroidProcessService,
		private $httpClient: Server.IHttpClient,
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
			this.adb.executeShellCommand(["monkey",
				"-p", appIdentifier,
				"-c", "android.intent.category.LAUNCHER",
				"1"]).wait();

			if (!this.$options.justlaunch || this.$options.duration) {
				this.$deviceLogService.printDeviceLog(this.identifier, this.$options.duration).wait();
			}
		}).future<void>()();
	}

	public stopApplication(appIdentifier: string): IFuture<void> {
		return this.adb.executeShellCommand(["am", "force-stop", `${appIdentifier}`]);
	}

	public getApplicationInfo(applicationIdentifier: string): IFuture<Mobile.IApplicationInfo> {
		// This method is currently only used in the ios application managers. Configurations for Android are acquired through filesystem listing.
		return Future.fromResult(null);
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

	public getDebuggableApps(): IFuture<Mobile.IDeviceApplicationInformation[]> {
		return this.$androidProcessService.getDebuggableApps(this.identifier);
	}

	public getDebuggableAppViews(appIdentifiers: string[]): IFuture<IDictionary<Mobile.IDebugWebViewInfo[]>> {
		return ((): IDictionary<Mobile.IDebugWebViewInfo[]> => {
			let mappedAppIdentifierPorts = this.$androidProcessService.getMappedAbstractToTcpPorts(this.identifier, appIdentifiers, TARGET_FRAMEWORK_IDENTIFIERS.Cordova).wait(),
				applicationViews: IDictionary<Mobile.IDebugWebViewInfo[]> = {};

			_.each(mappedAppIdentifierPorts, (port: number, appIdentifier: string) => {
				applicationViews[appIdentifier] = [];
				let localAddress = `http://127.0.0.1:${port}/json`;

				try {
					if (port) {
						let apps = this.$httpClient.httpRequest(localAddress).wait().body;
						applicationViews[appIdentifier] = JSON.parse(apps);
					}
				} catch (err) {
					this.$logger.trace(`Error while checking ${localAddress}. Error is: ${err.message}`);
				}
			});

			return applicationViews;

		}).future<IDictionary<Mobile.IDebugWebViewInfo[]>>()();
	}
}
