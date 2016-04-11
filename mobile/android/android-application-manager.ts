///<reference path="../../.d.ts"/>
"use strict";
import {EOL} from "os";
import {ApplicationManagerBase} from "../application-manager-base";

export class AndroidApplicationManager extends ApplicationManagerBase {

	constructor(private adb: Mobile.IAndroidDebugBridge,
		private identifier: string,
		private $staticConfig: Config.IStaticConfig,
		private $options: ICommonOptions,
		private $logcatHelper: Mobile.ILogcatHelper) {
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
		return this.adb.executeShellCommand(["pm", "uninstall", `${appIdentifier}`]);
	}

	public startApplication(appIdentifier: string): IFuture<void> {
		return (() => {
			this.adb.executeShellCommand(["am", "start",
				"-a", "android.intent.action.MAIN",
				"-n", `${appIdentifier}/${this.$staticConfig.START_PACKAGE_ACTIVITY_NAME}`,
				"-c", "android.intent.category.LAUNCHER"]).wait();
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
}
