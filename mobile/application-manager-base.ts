///<reference path="../.d.ts"/>
"use strict";

export abstract class ApplicationManagerBase {
	public reinstallApplication(appIdentifier: string, packageFilePath: string): IFuture<void> {
		return (() => {
			this.uninstallApplication(appIdentifier).wait();
			this.installApplication(packageFilePath).wait();
		}).future<void>()();
	}

	public restartApplication(appIdentifier: string, bundleExecutable?: string): IFuture<void> {
		return (() => {
			this.stopApplication(bundleExecutable || appIdentifier).wait();
			this.startApplication(appIdentifier).wait();
		}).future<void>()();
	}

	public isApplicationInstalled(appIdentifier: string): IFuture<boolean> {
		return (() => {
			let installedApplications = this.getInstalledApplications().wait();
			return _.contains(installedApplications, appIdentifier);
		}).future<boolean>()();
	}

	public abstract installApplication(packageFilePath: string): IFuture<void>;
	public abstract uninstallApplication(appIdentifier: string): IFuture<void>;
	public abstract startApplication(appIdentifier: string): IFuture<void>;
	public abstract stopApplication(appIdentifier: string): IFuture<void>;
	public abstract getInstalledApplications(): IFuture<string[]>;
}
