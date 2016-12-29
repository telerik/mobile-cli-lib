import { EventEmitter } from "events";
import { TARGET_FRAMEWORK_IDENTIFIERS } from "../constants";

export abstract class ApplicationManagerBase extends EventEmitter implements Mobile.IDeviceApplicationManager {
	private lastInstalledAppIdentifiers: string[];
	private lastAvailableDebuggableApps: Mobile.IDeviceApplicationInformation[];
	private lastAvailableDebuggableAppViews: IDictionary<Mobile.IDebugWebViewInfo[]> = {};

	constructor(protected $logger: ILogger,
		protected $hooksService: IHooksService) {
		super();
	}

	public async reinstallApplication(appIdentifier: string, packageFilePath: string): Promise<void> {
			this.uninstallApplication(appIdentifier).wait();
			this.installApplication(packageFilePath).wait();
	}

	public async restartApplication(appIdentifier: string, bundleExecutable?: string, framework?: string): Promise<void> {
			this.stopApplication(bundleExecutable || appIdentifier).wait();
			this.startApplication(appIdentifier, framework).wait();
	}

	public async isApplicationInstalled(appIdentifier: string): Promise<boolean> {
			if (!this.lastInstalledAppIdentifiers || !this.lastInstalledAppIdentifiers.length) {
				this.checkForApplicationUpdates().wait();
			}

			return _.includes(this.lastInstalledAppIdentifiers, appIdentifier);
	}

	private isChecking = false;
	public async checkForApplicationUpdates(): Promise<void> {
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
	}

	public async tryStartApplication(appIdentifier: string, framework?: string): Promise<void> {
			try {
				if (this.canStartApplication()) {
					this.startApplication(appIdentifier, framework).wait();
				}
			} catch (err) {
				this.$logger.trace(`Unable to start application ${appIdentifier}. Error is: ${err.message}`);
			}
	}

	public abstract isLiveSyncSupported(appIdentifier: string): IFuture<boolean>;

	public abstract installApplication(packageFilePath: string): IFuture<void>;
	public abstract uninstallApplication(appIdentifier: string): IFuture<void>;
	public abstract startApplication(appIdentifier: string, framework?: string): IFuture<void>;
	public abstract stopApplication(appIdentifier: string): IFuture<void>;
	public abstract getInstalledApplications(): IFuture<string[]>;
	public abstract getApplicationInfo(applicationIdentifier: string): IFuture<Mobile.IApplicationInfo>;
	public abstract canStartApplication(): boolean;
	public abstract getDebuggableApps(): IFuture<Mobile.IDeviceApplicationInformation[]>;
	public abstract getDebuggableAppViews(appIdentifiers: string[]): IFuture<IDictionary<Mobile.IDebugWebViewInfo[]>>;

	private async checkForAvailableDebuggableAppsChanges(): Promise<void> {
			let currentlyAvailableDebuggableApps = this.getDebuggableApps().wait();
			let previouslyAvailableDebuggableApps = this.lastAvailableDebuggableApps || [];

			let newAvailableDebuggableApps = _.differenceBy(currentlyAvailableDebuggableApps, previouslyAvailableDebuggableApps, "appIdentifier");
			let notAvailableAppsForDebugging = _.differenceBy(previouslyAvailableDebuggableApps, currentlyAvailableDebuggableApps, "appIdentifier");

			this.lastAvailableDebuggableApps = currentlyAvailableDebuggableApps;

			_.each(newAvailableDebuggableApps, (appInfo: Mobile.IDeviceApplicationInformation) => {
				this.emit("debuggableAppFound", appInfo);
			});

			_.each(notAvailableAppsForDebugging, (appInfo: Mobile.IDeviceApplicationInformation) => {
				this.emit("debuggableAppLost", appInfo);

				if (_.has(this.lastAvailableDebuggableAppViews, appInfo.appIdentifier)) {
					// Prevent emitting debuggableViewLost when application cannot be debugged anymore.
					delete this.lastAvailableDebuggableAppViews[appInfo.appIdentifier];
				}
			});

			let cordovaDebuggableAppIdentifiers = _(currentlyAvailableDebuggableApps)
				.filter(c => c.framework === TARGET_FRAMEWORK_IDENTIFIERS.Cordova)
				.map(c => c.appIdentifier)
				.value();

			let currentlyAvailableAppViews = this.getDebuggableAppViews(cordovaDebuggableAppIdentifiers).wait();

			_.each(currentlyAvailableAppViews, (currentlyAvailableViews, appIdentifier) => {
				let previouslyAvailableViews = this.lastAvailableDebuggableAppViews[appIdentifier];

				let newAvailableViews = _.differenceBy(currentlyAvailableViews, previouslyAvailableViews, "id");
				let notAvailableViews = _.differenceBy(previouslyAvailableViews, currentlyAvailableViews, "id");

				_.each(notAvailableViews, debugWebViewInfo => {
					this.emit("debuggableViewLost", appIdentifier, debugWebViewInfo);
				});

				_.each(newAvailableViews, debugWebViewInfo => {
					this.emit("debuggableViewFound", appIdentifier, debugWebViewInfo);
				});

				// Determine which of the views had changed since last check and raise debuggableViewChanged event for them:
				let keptViews = _.differenceBy(currentlyAvailableViews, newAvailableViews, "id");
				_.each(keptViews, view => {
					let previousTimeViewInfo = _.find(previouslyAvailableViews, previousView => previousView.id === view.id);
					if (!_.isEqual(view, previousTimeViewInfo)) {
						this.emit("debuggableViewChanged", appIdentifier, view);
					}
				});

				this.lastAvailableDebuggableAppViews[appIdentifier] = currentlyAvailableViews;
			});
	}
}
