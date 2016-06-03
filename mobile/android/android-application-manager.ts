///<reference path="../../.d.ts"/>
"use strict";
import {EOL} from "os";
import {ApplicationManagerBase} from "../application-manager-base";
import { LiveSyncConstants, StartPackageActivityNames } from "../../mobile/constants";

export class AndroidApplicationManager extends ApplicationManagerBase {

	constructor(private adb: Mobile.IDeviceAndroidDebugBridge,
		private identifier: string,
		private $staticConfig: Config.IStaticConfig,
		private $options: ICommonOptions,
		private $logcatHelper: Mobile.ILogcatHelper,
		private $project: Project.IProjectBase) {
		super();
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

	public startApplication(appIdentifier: string): IFuture<void> {
		return (() => {
			if (this.$project.projectData) {
				this.adb.executeShellCommand(["am", "start",
					"-a", "android.intent.action.MAIN",
					"-n", `${appIdentifier}/${this.$staticConfig.START_PACKAGE_ACTIVITY_NAME}`,
					"-c", "android.intent.category.LAUNCHER"]).wait();
			} else {
				let startActivityNames = [StartPackageActivityNames.CORDOVA, StartPackageActivityNames.NATIVESCRIPT];

				_.each(startActivityNames, (activityName: string) => {
					this.adb.executeShellCommand(["am", "start",
						"-a", "android.intent.action.MAIN",
						"-n", `${appIdentifier}/${activityName}`,
						"-c", "android.intent.category.LAUNCHER"]).wait();
				});
			}

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
}
