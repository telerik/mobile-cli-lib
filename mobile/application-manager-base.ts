import { EventEmitter } from "events";

export abstract class ApplicationManagerBase extends EventEmitter implements Mobile.IDeviceApplicationManager {
	private lastInstalledAppIdentifiers: string[];
	private lastAvailableDebuggableApps: Mobile.IAndroidApplicationInformation[];

	constructor(protected $logger: ILogger) {
		super();
	}

	public reinstallApplication(appIdentifier: string, packageFilePath: string): IFuture<void> {
		return (() => {
			this.uninstallApplication(appIdentifier).wait();
			this.installApplication(packageFilePath).wait();
		}).future<void>()();
	}

	public restartApplication(appIdentifier: string, bundleExecutable?: string, framework?: string): IFuture<void> {
		return (() => {
			this.stopApplication(bundleExecutable || appIdentifier).wait();
			this.startApplication(appIdentifier, framework).wait();
		}).future<void>()();
	}

	public isApplicationInstalled(appIdentifier: string): IFuture<boolean> {
		return (() => {
			if (!this.lastInstalledAppIdentifiers || !this.lastInstalledAppIdentifiers.length) {
				this.checkForApplicationUpdates().wait();
			}

			return _.includes(this.lastInstalledAppIdentifiers, appIdentifier);
		}).future<boolean>()();
	}

	private isChecking = false;
	public checkForApplicationUpdates(): IFuture<void> {
		return (() => {
			// As this method is called on 500ms, but it's execution may last much longer
			// use locking, so the next executions will not get into the body, while the first one is still working.
			// In case we do not break the next executions, we'll report each app as newly installed several times.
			if (!this.isChecking) {
				try {
					this.isChecking = true;
					let currentlyInstalledAppIdentifiers = this.getInstalledApplications().wait();
					let previouslyInstalledAppIdentifiers = this.lastInstalledAppIdentifiers || [];

					let newAppIdentifiers = _.difference(currentlyInstalledAppIdentifiers, previouslyInstalledAppIdentifiers);
					let removedAppIdentifiers = _.difference(previouslyInstalledAppIdentifiers, currentlyInstalledAppIdentifiers);

					this.lastInstalledAppIdentifiers = currentlyInstalledAppIdentifiers;

					_.each(newAppIdentifiers, appIdentifier => this.emit("applicationInstalled", appIdentifier));
					_.each(removedAppIdentifiers, appIdentifier => this.emit("applicationUninstalled", appIdentifier));

					this.checkForAvailableDebuggableAppsChanges().wait();
				} finally {
					this.isChecking = false;
				}
			}
		}).future<void>()();
	}

	public tryStartApplication(appIdentifier: string, framework?: string): IFuture<void> {
		return (() => {
			try {
				if (this.isApplicationInstalled(appIdentifier).wait() && this.canStartApplication()) {
					this.startApplication(appIdentifier, framework).wait();
				}
			} catch (err) {
				this.$logger.trace(`Unable to start application ${appIdentifier}. Error is: ${err.message}`);
			}
		}).future<void>()();
	}

	public abstract isLiveSyncSupported(appIdentifier: string): IFuture<boolean>;

	public abstract installApplication(packageFilePath: string): IFuture<void>;
	public abstract uninstallApplication(appIdentifier: string): IFuture<void>;
	public abstract startApplication(appIdentifier: string, framework?: string): IFuture<void>;
	public abstract stopApplication(appIdentifier: string): IFuture<void>;
	public abstract getInstalledApplications(): IFuture<string[]>;
	public abstract canStartApplication(): boolean;
	public abstract getDebuggableApps(): IFuture<Mobile.IAndroidApplicationInformation[]>;

	private checkForAvailableDebuggableAppsChanges(): IFuture<void> {
		return (() => {
			let currentlyAvailableDebuggableApps = this.getDebuggableApps().wait();
			let previouslyAvailableDebuggableApps = this.lastAvailableDebuggableApps || [];

			let newAvailableDebuggableApps = _.differenceBy(currentlyAvailableDebuggableApps, previouslyAvailableDebuggableApps, "packageId");
			let notAvailableAppsForDebugging = _.differenceBy(previouslyAvailableDebuggableApps, currentlyAvailableDebuggableApps, "packageId");

			this.lastAvailableDebuggableApps = currentlyAvailableDebuggableApps;

			_.each(newAvailableDebuggableApps, (appInfo: Mobile.IAndroidApplicationInformation) => this.emit("debuggableAppFound", appInfo));
			_.each(notAvailableAppsForDebugging, (appInfo: Mobile.IAndroidApplicationInformation) => this.emit("debuggableAppLost", appInfo));
		}).future<void>()();
	}
}
