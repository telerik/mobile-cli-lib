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
		await this.uninstallApplication(appIdentifier);
		await this.installApplication(packageFilePath, appIdentifier);
	}

	public async restartApplication(appIdentifier: string, appName?: string): Promise<void> {
		await this.stopApplication(appIdentifier, appName);
		await this.startApplication(appIdentifier);
	}

	public async isApplicationInstalled(appIdentifier: string): Promise<boolean> {
		await this.checkForApplicationUpdates();
		return _.includes(this.lastInstalledAppIdentifiers, appIdentifier);
	}

	private checkForApplicationUpdatesPromise: Promise<void>;
	public async checkForApplicationUpdates(): Promise<void> {
		if (!this.checkForApplicationUpdatesPromise) {
			this.checkForApplicationUpdatesPromise = new Promise<void>(async (resolve, reject) => {
				let isFulfilled = false;
				// As this method is called on 500ms, but it's execution may last much longer
				// use locking, so the next executions will not get into the body, while the first one is still working.
				// In case we do not break the next executions, we'll report each app as newly installed several times.
				try {
					let currentlyInstalledAppIdentifiers = await this.getInstalledApplications();
					let previouslyInstalledAppIdentifiers = this.lastInstalledAppIdentifiers || [];

					let newAppIdentifiers = _.difference(currentlyInstalledAppIdentifiers, previouslyInstalledAppIdentifiers);
					let removedAppIdentifiers = _.difference(previouslyInstalledAppIdentifiers, currentlyInstalledAppIdentifiers);

					this.lastInstalledAppIdentifiers = currentlyInstalledAppIdentifiers;

					_.each(newAppIdentifiers, appIdentifier => this.emit("applicationInstalled", appIdentifier));
					_.each(removedAppIdentifiers, appIdentifier => this.emit("applicationUninstalled", appIdentifier));

					await this.checkForAvailableDebuggableAppsChanges();
				} catch (err) {
					isFulfilled = true;
					reject(err);
				} finally {
					this.checkForApplicationUpdatesPromise = null;

					if (!isFulfilled) {
						resolve();
					}
				}
			});
		}

		return this.checkForApplicationUpdatesPromise;
	}

	public async tryStartApplication(appIdentifier: string): Promise<void> {
		try {
			if (this.canStartApplication()) {
				await this.startApplication(appIdentifier);
			}
		} catch (err) {
			this.$logger.trace(`Unable to start application ${appIdentifier}. Error is: ${err.message}`);
		}
	}

	public abstract async isLiveSyncSupported(appIdentifier: string): Promise<boolean>;

	public abstract async installApplication(packageFilePath: string, appIdentifier?: string): Promise<void>;
	public abstract async uninstallApplication(appIdentifier: string): Promise<void>;
	public abstract async startApplication(appIdentifier: string): Promise<void>;
	public abstract async stopApplication(appIdentifier: string, appName?: string): Promise<void>;
	public abstract async getInstalledApplications(): Promise<string[]>;
	public abstract async getApplicationInfo(applicationIdentifier: string): Promise<Mobile.IApplicationInfo>;
	public abstract canStartApplication(): boolean;
	public abstract async getDebuggableApps(): Promise<Mobile.IDeviceApplicationInformation[]>;
	public abstract async getDebuggableAppViews(appIdentifiers: string[]): Promise<IDictionary<Mobile.IDebugWebViewInfo[]>>;

	private async checkForAvailableDebuggableAppsChanges(): Promise<void> {
		let currentlyAvailableDebuggableApps = await this.getDebuggableApps();
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

		let currentlyAvailableAppViews = await this.getDebuggableAppViews(cordovaDebuggableAppIdentifiers);

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
