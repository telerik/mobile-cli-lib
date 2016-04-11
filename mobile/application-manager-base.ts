///<reference path="../.d.ts"/>
"use strict";

import { EventEmitter } from "events";

export abstract class ApplicationManagerBase extends EventEmitter implements Mobile.IDeviceApplicationManager {
	private lastInstalledApplications: string[];

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

	public checkForApplicationUpdates(): IFuture<void> {
		return (() => {
			let newInstalledApplications = this.getInstalledApplications().wait();
			let previouslyInstalledApplications = this.lastInstalledApplications || [];

			_(newInstalledApplications)
				.difference(previouslyInstalledApplications)
				.each(application => this.emit("applicationInstalled", application))
				.value();

			_(previouslyInstalledApplications)
				.difference(newInstalledApplications)
				.each(application => this.emit("applicationUninstalled", application))
				.value();

			this.lastInstalledApplications = newInstalledApplications;
		}).future<void>()();
	}

	public abstract installApplication(packageFilePath: string): IFuture<void>;
	public abstract uninstallApplication(appIdentifier: string): IFuture<void>;
	public abstract startApplication(appIdentifier: string): IFuture<void>;
	public abstract stopApplication(appIdentifier: string): IFuture<void>;
	public abstract getInstalledApplications(): IFuture<string[]>;
	public abstract canStartApplication(): boolean;
}
