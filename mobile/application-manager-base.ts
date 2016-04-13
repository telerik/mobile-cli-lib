///<reference path="../.d.ts"/>
"use strict";

import { EventEmitter } from "events";
import { getFuturesResults } from "../helpers";

export abstract class ApplicationManagerBase extends EventEmitter implements Mobile.IDeviceApplicationManager {
	private lastInstalledAppIdentifiers: string[];
	public applicationsLiveSyncStatus: Mobile.IApplicationLiveSyncStatus[];

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

	private isChecking = false;
	public checkForApplicationUpdates(): IFuture<void> {
		return (() => {
			// As this method is called on 500ms, but it's execution may last much longer
			// use locking, so the next executions will not get into the body, while the first one is still working.
			// In case we do not break the next executions, we'll report each app as newly installed several times.
			if(!this.isChecking) {
				try {
					this.isChecking = true;
					let currentlyInstalledAppIdentifiers = this.getInstalledApplications().wait();
					let previouslyInstalledAppIdentifiers = this.lastInstalledAppIdentifiers || [];

					let newAppIdentifiers = _.difference(currentlyInstalledAppIdentifiers, previouslyInstalledAppIdentifiers);
					let removedAppIdentifiers = _.difference(previouslyInstalledAppIdentifiers, currentlyInstalledAppIdentifiers);

					if(newAppIdentifiers.length || removedAppIdentifiers.length) {
						this.applicationsLiveSyncStatus = _.reject(this.applicationsLiveSyncStatus,
															(app: Mobile.IApplicationLiveSyncStatus) => _.contains(removedAppIdentifiers, app.applicationIdentifier));
						this.getApplicationsLiveSyncSupportedStatus(newAppIdentifiers).wait();
					}

					_.each(newAppIdentifiers, application => this.emit("applicationInstalled", application, {isLiveSyncSupported: this.isLiveSyncSupported(application).wait()} ));
					_.each(removedAppIdentifiers, application => this.emit("applicationUninstalled", application));

					this.lastInstalledAppIdentifiers = currentlyInstalledAppIdentifiers;
				} finally {
					this.isChecking = false;
				}
			}
		}).future<void>()();
	}

	public getApplicationsLiveSyncSupportedStatus(newAppIdentifiers: string[]): IFuture<void> {
		return (() => {
			let liveSyncStatus = getFuturesResults<boolean>(_.map(newAppIdentifiers, appIdentifier => this.isLiveSyncSupportedOnDevice(appIdentifier)), () => true);
			this.applicationsLiveSyncStatus = (this.applicationsLiveSyncStatus || [])
												.concat(_.map(newAppIdentifiers, (appIdentifier: string, index: number) =>
															({ applicationIdentifier: appIdentifier, isLiveSyncSupported: liveSyncStatus[index]})
												));
		}).future<void>()();
	}

	public isLiveSyncSupported(appIdentifier: string): IFuture<boolean> {
		return ((): boolean => {
			if(!this.applicationsLiveSyncStatus || !this.applicationsLiveSyncStatus.length) {
				this.checkForApplicationUpdates().wait();
			}
			let applicationLiveSyncData = _.find(this.applicationsLiveSyncStatus, app => app.applicationIdentifier === appIdentifier);
			return !!applicationLiveSyncData && !!applicationLiveSyncData.isLiveSyncSupported;
		}).future<boolean>()();
	}

	protected isLiveSyncSupportedOnDevice(appIdentifier: string): IFuture<boolean> {
		return (() => {
			throw new Error("This method should not be called.");
		}).future<boolean>()();
	}

	public abstract installApplication(packageFilePath: string): IFuture<void>;
	public abstract uninstallApplication(appIdentifier: string): IFuture<void>;
	public abstract startApplication(appIdentifier: string): IFuture<void>;
	public abstract stopApplication(appIdentifier: string): IFuture<void>;
	public abstract getInstalledApplications(): IFuture<string[]>;
	public abstract canStartApplication(): boolean;
}
