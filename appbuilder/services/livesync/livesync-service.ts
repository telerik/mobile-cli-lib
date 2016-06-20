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

	@exportedPromise("liveSyncService", function() {
		this.$devicesService.startDeviceDetectionInterval();
	})
	public livesync(deviceDescriptors: IDeviceLiveSyncInfo[], projectDir: string, filePaths?: string[]): IFuture<IDeviceLiveSyncResult>[] {
		this.$project.projectDir = projectDir;
		this.$logger.trace(`Called livesync for identifiers ${_.map(deviceDescriptors, d => d.deviceIdentifier)}. Project dir is ${projectDir}. Files are: ${filePaths}`);
		return _.map(deviceDescriptors, deviceDescriptor => this.liveSyncOnDevice(deviceDescriptor, filePaths));
	}

	@exportedPromise("liveSyncService")
	public deleteFiles(deviceDescriptors: IDeviceLiveSyncInfo[], projectDir: string, filePaths: string[]): IFuture<IDeviceLiveSyncResult>[] {
		this.$project.projectDir = projectDir;
		this.$logger.trace(`Called deleteFiles for identifiers ${_.map(deviceDescriptors, d => d.deviceIdentifier)}. Project dir is ${projectDir}. Files are: ${filePaths}`);
		return _.map(deviceDescriptors, deviceDescriptor => this.liveSyncOnDevice(deviceDescriptor, filePaths, { isForDeletedFiles: true}));
	}

	private liveSyncOnDevice(deviceDescriptor: IDeviceLiveSyncInfo, filePaths: string[], liveSyncOptions?: { isForDeletedFiles: boolean }): IFuture<IDeviceLiveSyncResult> {
		return ((): IDeviceLiveSyncResult => {
			let isForDeletedFiles = liveSyncOptions && liveSyncOptions.isForDeletedFiles;

			this.$devicesService.stopDeviceDetectionInterval().wait();
			let result: IDeviceLiveSyncResult = {
				deviceIdentifier: deviceDescriptor.deviceIdentifier
			};

			let device = _.find(this.$devicesService.getDeviceInstances(), d => d.deviceInfo.identifier === deviceDescriptor.deviceIdentifier);
			if(!device) {
				result.liveSyncToApp = result.liveSyncToCompanion = {
					isResolved: false,
					error: new Error(`Cannot find connected device with identifier ${deviceDescriptor.deviceIdentifier}. Available device identifiers are: ${this.$devicesService.getDeviceInstances()}`)
				};

				return result;
			}

			if (!this.$fs.exists(this.$project.projectDir).wait()) {
				result.liveSyncToApp = result.liveSyncToCompanion = {
					isResolved: false,
					error: new Error(`Cannot execute LiveSync operation as the project dir ${this.$project.projectDir} does not exist on the file system.`)
				};

				return result;
			}

			if (!isForDeletedFiles && filePaths && filePaths.length) {
				let missingFiles = filePaths.filter(filePath => !this.$fs.exists(filePath).wait());
				if (missingFiles && missingFiles.length) {
					result.liveSyncToApp = result.liveSyncToCompanion = {
						isResolved: false,
						error: new Error(`Cannot LiveSync files ${missingFiles.join(", ")} as they do not exist on the file system.`)
					};

					return result;
				}
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
				result.liveSyncToApp = this.liveSyncCore(livesyncData, device, appIdentifier, canExecuteAction, { isForCompanionApp: false, isForDeletedFiles: isForDeletedFiles }, filePaths).wait();
			}

			if(deviceDescriptor.syncToCompanion) {
				result.liveSyncToCompanion = this.liveSyncCore(livesyncData, device, appIdentifier, canExecuteAction, { isForCompanionApp: true, isForDeletedFiles: isForDeletedFiles }, filePaths).wait();
			}

			return result;
		}).future<IDeviceLiveSyncResult>()();
	}

	private liveSyncCore(livesyncData: ILiveSyncData, device: Mobile.IDevice, appIdentifier: string, canExecuteAction: (dev: Mobile.IDevice) => boolean, liveSyncOptions: { isForCompanionApp: boolean, isForDeletedFiles?: boolean }, filePaths: string[]): IFuture<ILiveSyncOperationResult> {
		return (() => {
			let liveSyncOperationResult: ILiveSyncOperationResult = {
				isResolved: false
			};

			if(liveSyncOptions.isForCompanionApp) {
				// We should check if the companion app is installed, not the real application.
				livesyncData.appIdentifier = appIdentifier = this.$companionAppsService.getCompanionAppIdentifier(this.$project.projectData.Framework, device.deviceInfo.platform);
			}

			if(device.applicationManager.isApplicationInstalled(appIdentifier).wait()) {

				let deletedFilesAction: any =  liveSyncOptions && liveSyncOptions.isForDeletedFiles ? this.$liveSyncServiceBase.getSyncRemovedFilesAction(livesyncData) : null;
				let action: any = this.$liveSyncServiceBase.getSyncAction(livesyncData, filePaths, deletedFilesAction, liveSyncOptions);
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
}
$injector.register("liveSyncService", ProtonLiveSyncService);
