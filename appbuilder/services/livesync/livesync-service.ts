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
		private $logger: ILogger,
		private $companionAppsService: ICompanionAppsService) { }

	@exportedPromise("liveSyncService")
	public livesync(deviceDescriptors: IDeviceLiveSyncInfo[], projectDir: string, filePaths?: string[]): IFuture<IDeviceLiveSyncResult>[] {
		this.$project.projectDir = projectDir;
		this.$logger.trace(`Called livesync for identifiers ${_.map(deviceDescriptors, d => d.deviceIdentifier)}. Project dir is ${projectDir}. Files are: ${filePaths}`);
		return _.map(deviceDescriptors, deviceDescriptor => this.liveSyncOnDevice(deviceDescriptor, filePaths));
	}

	@exportedPromise("liveSyncService")
	public isLiveSyncSupported(deviceIdentifiers: string[], appIdentifier: string, framework: string): IFuture<ILiveSyncSupportedInfo>[] {
		this.$logger.trace(`Called isLiveSyncSupported for identifiers ${deviceIdentifiers}. AppIdentifier is ${appIdentifier}.`);
		return _.map(deviceIdentifiers, deviceId => this.isLiveSyncSupportedOnDevice(deviceId, appIdentifier, framework));
	}

	private liveSyncOnDevice(deviceDescriptor: IDeviceLiveSyncInfo, filePaths: string[]): IFuture<IDeviceLiveSyncResult> {
		return ((): IDeviceLiveSyncResult => {
			let result: IDeviceLiveSyncResult = {
				deviceIdentifier: deviceDescriptor.deviceIdentifier
			};

			let device = _.find(this.$devicesService.getDeviceInstances(), d => d.deviceInfo.identifier === deviceDescriptor.deviceIdentifier);
			if(!device) {
				result.liveSyncToApp = result.liveSyncToCompanion = {
					isResolved: false,
					error: new Error(`Cannot find connected device with identifier ${deviceDescriptor.deviceIdentifier}.`)
				};

				return result;
			}

			let appIdentifier = this.$project.projectData.AppIdentifier,
				canExecute = (d: Mobile.IDevice) => d.deviceInfo.identifier === device.deviceInfo.identifier,
				livesyncData: ILiveSyncData = {
					platform: device.deviceInfo.platform,
					appIdentifier: appIdentifier,
					projectFilesPath: this.$project.projectDir,
					syncWorkingDirectory: this.$project.projectDir,
					excludedProjectDirsAndFiles: this.excludedProjectDirsAndFiles,
					canExecuteFastSync: false
				};

			let canExecuteAction = this.$liveSyncServiceBase.getCanExecuteAction(device.deviceInfo.platform, appIdentifier, canExecute);
			if(deviceDescriptor.syncToApp) {
				result.liveSyncToApp = this.liveSyncCore(livesyncData, device, appIdentifier, canExecuteAction, { isForCompanionApp: false }, filePaths).wait();
			}

			if(deviceDescriptor.syncToCompanion) {
				result.liveSyncToCompanion = this.liveSyncCore(livesyncData, device, appIdentifier, canExecuteAction, { isForCompanionApp: true }, filePaths).wait();
			}

			return result;
		}).future<IDeviceLiveSyncResult>()();
	}

	private liveSyncCore(livesyncData: ILiveSyncData, device: Mobile.IDevice, appIdentifier: string, canExecuteAction: (dev: Mobile.IDevice) => boolean, liveSyncOptions: { isForCompanionApp: boolean }, filePaths: string[]): IFuture<ILiveSyncOperationResult> {
		return (() => {
			let liveSyncOperationResult: ILiveSyncOperationResult = {
				isResolved: false
			};

			if(liveSyncOptions.isForCompanionApp) {
				// We should check if the companion app is installed, not the real application.
				livesyncData.appIdentifier = appIdentifier = this.$companionAppsService.getCompanionAppIdentifier(this.$project.projectData.Framework, device.deviceInfo.platform);
			}

			if(device.applicationManager.isApplicationInstalled(appIdentifier).wait()) {
				let action: any = this.$liveSyncServiceBase.getSyncAction(livesyncData, filePaths, null, liveSyncOptions);
				try {
					this.$devicesService.execute(action, canExecuteAction).wait();
					liveSyncOperationResult.isResolved = true;
				} catch (err) {
					liveSyncOperationResult.error = err;
					liveSyncOperationResult.isResolved = false;
				}
			} else {
				liveSyncOperationResult.error = new Error(`Application with id ${appIdentifier} is not installed on device with id ${device.deviceInfo.identifier} and it cannot be livesynced.`);
				liveSyncOperationResult.isResolved = false;
			}

			return liveSyncOperationResult;
		}).future<ILiveSyncOperationResult>()();
	}

	private isLiveSyncSupportedOnDevice(deviceIdentifier: string, appIdentifier: string, framework: string): IFuture<ILiveSyncSupportedInfo> {
		return ((): ILiveSyncSupportedInfo => {
			let device = this.$devicesService.getDeviceByIdentifier(deviceIdentifier);
			device.applicationManager.tryStartApplication(appIdentifier, framework).wait();
			let isLiveSyncSupported = !!device.applicationManager.isLiveSyncSupported(appIdentifier).wait();
			return {
				deviceIdentifier,
				appIdentifier,
				isLiveSyncSupported
			};
		}).future<ILiveSyncSupportedInfo>()();
	}
}
$injector.register("liveSyncService", ProtonLiveSyncService);
