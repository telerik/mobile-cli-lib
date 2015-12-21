///<reference path="../../.d.ts"/>
"use strict";
import {EOL} from "os";

export class AndroidApplicationManager implements Mobile.IDeviceApplicationManager {
	private _installedApplications: string[];

	constructor(private adb: Mobile.IAndroidDebugBridge,
		private identifier: string,
		private $staticConfig: Config.IStaticConfig,
		private $options: ICommonOptions,
		private $logcatHelper: Mobile.ILogcatHelper) { }

	public getInstalledApplications(): IFuture<string[]> {
		return (() => {
			if (!this._installedApplications) {
				let result = this.adb.executeShellCommand(["pm", "list", "packages"]).wait();
				let regex = /package:(.+)/;
				this._installedApplications = _.map(result.split(EOL), (packageString: string) => {
					let match = packageString.match(regex);
					return match ? match[1] : null;
				}).filter(parsedPackage => parsedPackage !== null);
			}

			return this._installedApplications;
		}).future<string[]>()();
	}

	public installApplication(packageFilePath: string): IFuture<void> {
		this._installedApplications = null;
		return this.adb.executeCommand(["install", "-r", `${packageFilePath}`]);
	}

	public uninstallApplication(appIdentifier: string): IFuture<void> {
		this._installedApplications = null;
		return this.adb.executeShellCommand(["pm", "uninstall", `${appIdentifier}`]);
	}

	public reinstallApplication(applicationId: string, packageFilePath: string): IFuture<void> {
		return (() => {
			this.uninstallApplication(applicationId).wait();
			this.installApplication(packageFilePath).wait();
		}).future<void>()();
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

	public restartApplication(appIdentifier: string): IFuture<void> {
		return (() => {
			this.stopApplication(appIdentifier).wait();
			this.startApplication(appIdentifier).wait();
		}).future<void>()();
	}

	public canStartApplication(): boolean {
		return true;
	}
}
