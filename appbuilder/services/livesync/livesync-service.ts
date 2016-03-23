///<reference path="../../../.d.ts"/>
"use strict";

import { exportedPromise } from "../../../decorators";

export class ProtonLiveSyncService implements IProtonLiveSyncService {
	private excludedProjectDirsAndFiles = ["app_resources", "plugins", ".*.tmp", ".ab"];

	private get $liveSyncServiceBase(): ILiveSyncServiceBase {
		return this.$injector.resolve("liveSyncServiceBase");
	}

	constructor(private $devicesService: Mobile.IDevicesService,
		private $errors: IErrors,
		private $mobileHelper: Mobile.IMobileHelper,
		private $options: ICommonOptions,
		private $fs: IFileSystem,
		private $injector: IInjector,
		private $project: Project.IProjectBase,
		private $logger: ILogger) { }

	@exportedPromise("liveSyncService")
	public livesync(deviceIdentifiers: IDeviceLiveSyncInfo[], projectDir: string, filePaths?: string[]): IFuture<void> {
		return (() => {
			this.$project.projectDir = projectDir;
			let deviceInfos: any = _.map(deviceIdentifiers, d => {
				let matchingDevice = _.find(this.$devicesService.getDeviceInstances(), device => device.deviceInfo.identifier === d.deviceIdentifier);
				return _.extend(d, { device: matchingDevice });
			});

			let errors: Error[] = [];
			// Group devices by platform. After that group each group by types of sync.
			// Aggregate the errors and throw a single error in case any operation fails.
			let groupedByPlatform = _.groupBy(deviceInfos, (d: any) => d.device.deviceInfo.platform.toLowerCase());
			_.each(groupedByPlatform, (platformGroup: any[], platform: string) => {
				let syncToApp = platformGroup.filter(plGr => !!plGr.syncToApp);
				try {
					this.liveSyncToApp(platform, syncToApp.map((s: any) => s.device), filePaths).wait();
				} catch (err) {
					this.$logger.trace(`Error while trying to livesync applications to devices: ${syncToApp.join(", ")}.`, err.message);
					errors.push(err);
				}

				let syncToCompanion =  platformGroup.filter(plGr => !!plGr.syncToCompanion);
				try {
					this.liveSyncToCompanion(platform, syncToCompanion.map((s: any) => s.device), filePaths).wait();
				} catch (err) {
					this.$logger.trace(`Error while trying to livesync to companion app to devices: ${syncToCompanion.join(", ")}.`, err.message);
					errors.push(err);
				}
			});

			if(errors && errors.length) {
				throw new Error(`Unable to livesync to specified devices. Errors are: ${errors.map(err => err.message)}`);
			}
		}).future<void>()();
	}

	private liveSyncToApp(platform: string, devices: Mobile.IDevice[], filePaths: string[]): IFuture<void> {
		return (() => {
			this.$options.companion = false;
			if(!this.$project.capabilities.livesync) {
				this.$errors.failWithoutHelp(`You cannot use LiveSync for ${this.$project.projectData.Framework} projects.`);
			}

			this.liveSyncCore(platform, devices, filePaths).wait();
		}).future<void>()();
	}

	private liveSyncToCompanion(platform: string, devices: Mobile.IDevice[], filePaths: string[]): IFuture<void> {
		return (() => {
			this.$options.companion = true;

			if(!this.$mobileHelper.getPlatformCapabilities(platform).companion) {
				this.$errors.failWithoutHelp(`The Companion app is not available on ${platform} devices.`);
			}

			if(!this.$project.capabilities.livesyncCompanion) {
				this.$errors.failWithoutHelp(`You cannot use LiveSync to Companion app for ${this.$project.projectData.Framework} projects.`);
			}

			this.liveSyncCore(platform, devices, filePaths).wait();
		}).future<void>()();
	}

	private liveSyncCore(platform: string, devices: Mobile.IDevice[], filePaths: string[]): IFuture<void> {
		return (() => {
			let livesyncData: ILiveSyncData = {
				platform: platform,
				appIdentifier: this.$project.projectData.AppIdentifier,
				projectFilesPath: this.$project.projectDir,
				syncWorkingDirectory: this.$project.projectDir,
				excludedProjectDirsAndFiles: this.excludedProjectDirsAndFiles,
				canExecuteFastSync: false,
				canExecute: (device: Mobile.IDevice) =>  device.deviceInfo.platform.toLowerCase() === platform.toLowerCase() && !!_.any(devices, d => d.deviceInfo.identifier === device.deviceInfo.identifier)
			};

			this.$liveSyncServiceBase.sync(livesyncData, filePaths).wait();
		}).future<void>()();
	}
}
$injector.register("liveSyncService", ProtonLiveSyncService);
