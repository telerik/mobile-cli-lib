import * as fiberBootstrap from "../fiber-bootstrap";
import syncBatchLib = require("./livesync/sync-batch");
import * as shell from "shelljs";
import * as path from "path";
import * as temp from "temp";
import * as minimatch from "minimatch";
import * as constants from "../constants";
import * as util from "util";

let gaze = require("gaze");

class LiveSyncServiceBase implements ILiveSyncServiceBase {
	private showFullLiveSyncInformation: boolean = false;
	private fileHashes: IDictionary<string>;

	constructor(protected $devicesService: Mobile.IDevicesService,
		protected $mobileHelper: Mobile.IMobileHelper,
		protected $logger: ILogger,
		protected $options: ICommonOptions,
		protected $deviceAppDataFactory: Mobile.IDeviceAppDataFactory,
		protected $fs: IFileSystem,
		protected $injector: IInjector,
		protected $hooksService: IHooksService,
		private $projectFilesManager: IProjectFilesManager,
		private $projectFilesProvider: IProjectFilesProvider,
		private $liveSyncProvider: ILiveSyncProvider,
		private $devicePlatformsConstants: Mobile.IDevicePlatformsConstants,
		private $hostInfo: IHostInfo,
		private $dispatcher: IFutureDispatcher) {
		this.fileHashes = Object.create(null);
	}

	public async sync(data: ILiveSyncData[], filePaths?: string[]): Promise<void> {
			await this.syncCore(data, filePaths);
			if (this.$options.watch) {
				await this.$hooksService.executeBeforeHooks('watch');
				this.partialSync(data, data[0].syncWorkingDirectory);
			}
	}

	private isFileExcluded(filePath: string, excludedPatterns: string[]): boolean {
		let isFileExcluded = false;
		_.each(excludedPatterns, pattern => {
			if (minimatch(filePath, pattern, { nocase: true })) {
				isFileExcluded = true;
				return false;
			}
		});

		return isFileExcluded;
	}

	private partialSync(data: ILiveSyncData[], syncWorkingDirectory: string): void {
		let that = this;
		this.showFullLiveSyncInformation = true;
		gaze("**/*", { cwd: syncWorkingDirectory }, function (err: any, watcher: any) {
			this.on('all', (event: string, filePath: string) => {
				fiberBootstrap.run(() => {
					that.$dispatcher.dispatch(() => (() => {
						try {
							if (filePath.indexOf(constants.APP_RESOURCES_FOLDER_NAME) !== -1) {
								that.$logger.warn(`Skipping livesync for changed file ${filePath}. This change requires a full build to update your application. `.yellow.bold);
								return;
							}

							let fileHash = await that.$fs.exists(filePath) && that.$fs.getFsStats(filePath).isFile() ? that.$fs.getFileShasum(filePath) : "";
							if (fileHash === that.fileHashes[filePath]) {
								that.$logger.trace(`Skipping livesync for ${filePath} file with ${fileHash} hash.`);
								return;
							}

							that.$logger.trace(`Adding ${filePath} file with ${fileHash} hash.`);
							that.fileHashes[filePath] = <string>fileHash;

							for (let dataItem of data) {
								if (that.isFileExcluded(filePath, dataItem.excludedProjectDirsAndFiles)) {
									that.$logger.trace(`Skipping livesync for changed file ${filePath} as it is excluded in the patterns: ${dataItem.excludedProjectDirsAndFiles.join(", ")}`);
									continue;
								}
								let mappedFilePath = that.$projectFilesProvider.mapFilePath(filePath, dataItem.platform);
								that.$logger.trace(`Syncing filePath ${filePath}, mappedFilePath is ${mappedFilePath}`);
								if (!mappedFilePath) {
									that.$logger.warn(`Unable to sync ${filePath}.`);
									continue;
								}

								if (event === "added" || event === "changed" || event === "renamed") {
									that.batchSync(dataItem, mappedFilePath);
								} else if (event === "deleted") {
									that.fileHashes = <any>(_.omit(that.fileHashes, filePath));
									await that.syncRemovedFile(dataItem, mappedFilePath);
								}
							}
						} catch (err) {
							that.$logger.info(`Unable to sync file ${filePath}. Error is:${err.message}`.red.bold);
							that.$logger.info("Try saving it again or restart the livesync operation.");
						}
					}).future<void>()());
				});
			});
		});

		this.$dispatcher.run();
	}

	private batch: IDictionary<ISyncBatch> = Object.create(null);
	private livesyncData: IDictionary<ILiveSyncData> = Object.create(null);

	private batchSync(data: ILiveSyncData, filePath: string): void {
		let platformBatch: ISyncBatch = this.batch[data.platform];
		if (!platformBatch || !platformBatch.syncPending) {
			let done = () => {
				return (() => {
					setTimeout(() => {
						fiberBootstrap.run(() => {
							this.$dispatcher.dispatch(() => (() => {
								try {
									for (let platformName in this.batch) {
										let batch = this.batch[platformName];
										let livesyncData = this.livesyncData[platformName];
										batch.syncFiles(async (filesToSync: string[]) => {
											await this.$liveSyncProvider.preparePlatformForSync(platformName);
											this.syncCore([livesyncData], filesToSync);
										});
									}
								} catch (err) {
									this.$logger.warn(`Unable to sync files. Error is:`, err.message);
								}
							}).future<void>()());

						});
					}, syncBatchLib.SYNC_WAIT_THRESHOLD);
				}).future<void>()();
			};
			this.batch[data.platform] = this.$injector.resolve(syncBatchLib.SyncBatch, { done: done });
			this.livesyncData[data.platform] = data;
		}

		this.batch[data.platform].addFile(filePath);
	}

	private async syncRemovedFile(data: ILiveSyncData, filePath: string): Promise<void> {
			let filePathArray = [filePath],
				deviceFilesAction = this.getSyncRemovedFilesAction(data);

			await this.syncCore([data], filePathArray, deviceFilesAction);
	}

	public getSyncRemovedFilesAction(data: ILiveSyncData): (deviceAppData: Mobile.IDeviceAppData, device: Mobile.IDevice, localToDevicePaths: Mobile.ILocalToDevicePathData[]) => Promise<void> {
		return (deviceAppData: Mobile.IDeviceAppData, device: Mobile.IDevice, localToDevicePaths: Mobile.ILocalToDevicePathData[]) => {
			let platformLiveSyncService = this.resolveDeviceLiveSyncService(data.platform, device);
			return platformLiveSyncService.removeFiles(deviceAppData.appIdentifier, localToDevicePaths);
		};
	}

	public getSyncAction(data: ILiveSyncData, filesToSync: string[], deviceFilesAction: (deviceAppData: Mobile.IDeviceAppData, device: Mobile.IDevice, localToDevicePaths: Mobile.ILocalToDevicePathData[]) => Promise<void>, liveSyncOptions: ILiveSyncOptions): (device: Mobile.IDevice) => Promise<void> {
		let appIdentifier = data.appIdentifier;
		let platform = data.platform;
		let projectFilesPath = data.projectFilesPath;

		let packageFilePath: string = null;

		let action = async (device: Mobile.IDevice): Promise<void> => {
				let shouldRefreshApplication = true;
				let deviceAppData = this.$deviceAppDataFactory.create(appIdentifier, this.$mobileHelper.normalizePlatformName(platform), device, liveSyncOptions);
				if (await deviceAppData.isLiveSyncSupported()) {
					let platformLiveSyncService = this.resolveDeviceLiveSyncService(platform, device);

					if (platformLiveSyncService.beforeLiveSyncAction) {
						await platformLiveSyncService.beforeLiveSyncAction(deviceAppData);
					}

					// Not installed application
					await device.applicationManager.checkForApplicationUpdates();

					let wasInstalled = true;
					if (! await device.applicationManager.isApplicationInstalled(appIdentifier) && !this.$options.companion) {
						this.$logger.warn(`The application with id "${appIdentifier}" is not installed on device with identifier ${device.deviceInfo.identifier}.`);
						if (!packageFilePath) {
							packageFilePath = await  this.$liveSyncProvider.buildForDevice(device);
						}
						await device.applicationManager.installApplication(packageFilePath);

						if (platformLiveSyncService.afterInstallApplicationAction) {
							let localToDevicePaths = this.$projectFilesManager.createLocalToDevicePaths(deviceAppData, projectFilesPath, filesToSync, data.excludedProjectDirsAndFiles, liveSyncOptions);
							shouldRefreshApplication = await  platformLiveSyncService.afterInstallApplicationAction(deviceAppData, localToDevicePaths);
						} else {
							shouldRefreshApplication = false;
						}

						if (device.applicationManager.canStartApplication() && !shouldRefreshApplication) {
							await device.applicationManager.startApplication(appIdentifier);
						}
						wasInstalled = false;
					}

					// Restart application or reload page
					if (shouldRefreshApplication) {
						// Transfer or remove files on device
						let localToDevicePaths = this.$projectFilesManager.createLocalToDevicePaths(deviceAppData, projectFilesPath, filesToSync, data.excludedProjectDirsAndFiles, liveSyncOptions);
						if (deviceFilesAction) {
							await deviceFilesAction(deviceAppData, device, localToDevicePaths);
						} else {
							this.transferFiles(deviceAppData, localToDevicePaths, projectFilesPath, ! await filesToSync);
						}

						this.$logger.info("Applying changes...");
						platformLiveSyncService.refreshApplication(deviceAppData, localToDevicePaths, data.forceExecuteFullSync || await  !wasInstalled);
						this.$logger.info(`Successfully synced application ${data.appIdentifier} on device ${device.deviceInfo.identifier}.`);
					}
				} else {
					this.$logger.warn(`LiveSync is not supported for application: ${deviceAppData.appIdentifier} on device with identifier ${device.deviceInfo.identifier}.`);
				}
		};

		return action;
	}

	private async syncCore(data: ILiveSyncData[], filesToSync: string[], deviceFilesAction?: (deviceAppData: Mobile.IDeviceAppData, device: Mobile.IDevice, localToDevicePaths: Mobile.ILocalToDevicePathData[]) => Promise<void>): Promise<void> {
			for (let dataItem of data) {
				let appIdentifier = dataItem.appIdentifier;
				let platform = dataItem.platform;
				let canExecute = this.getCanExecuteAction(platform, appIdentifier, dataItem.canExecute);
				let action = this.getSyncAction(dataItem, filesToSync, deviceFilesAction, { isForCompanionApp: this.$options.companion, additionalConfigurations: dataItem.additionalConfigurations, configuration: dataItem.configuration, isForDeletedFiles: false });
				await this.$devicesService.execute(action, canExecute);
			}
	}

	private async transferFiles(deviceAppData: Mobile.IDeviceAppData, localToDevicePaths: Mobile.ILocalToDevicePathData[], projectFilesPath: string, isFullSync: boolean): Promise<void> {
			this.$logger.info("Transferring project files...");
			this.logFilesSyncInformation(localToDevicePaths, "Transferring %s.", this.$logger.trace);

			let canTransferDirectory = isFullSync && (this.$devicesService.isAndroidDevice(deviceAppData.device) || this.$devicesService.isiOSSimulator(deviceAppData.device));
			if (canTransferDirectory) {
				let tempDir = temp.mkdirSync("tempDir");
				_.each(localToDevicePaths, localToDevicePath => {
					let fileDirname = path.join(tempDir, path.dirname(localToDevicePath.getRelativeToProjectBasePath()));
					shell.mkdir("-p", fileDirname);
					if (!this.$fs.getFsStats(localToDevicePath.getLocalPath()).isDirectory()) {
						shell.cp("-f", localToDevicePath.getLocalPath(), path.join(fileDirname, path.basename(localToDevicePath.getDevicePath())));
					}
				});
				await deviceAppData.device.fileSystem.transferDirectory(deviceAppData, localToDevicePaths, tempDir);
			} else {
				await this.$liveSyncProvider.transferFiles(deviceAppData, localToDevicePaths, projectFilesPath, isFullSync);
			}

			this.logFilesSyncInformation(localToDevicePaths, "Successfully transferred %s.", this.$logger.info);
	}

	private logFilesSyncInformation(localToDevicePaths: Mobile.ILocalToDevicePathData[], message: string, action: Function): void {
		if (this.showFullLiveSyncInformation) {
			_.each(localToDevicePaths, (file: Mobile.ILocalToDevicePathData) => {
				action.call(this.$logger, util.format(message, path.basename(file.getLocalPath()).yellow));
			});
		} else {
			action.call(this.$logger, util.format(message, "all files"));
		}
	}

	private resolveDeviceLiveSyncService(platform: string, device: Mobile.IDevice): IDeviceLiveSyncService {
		return this.$injector.resolve(this.$liveSyncProvider.deviceSpecificLiveSyncServices[platform.toLowerCase()], { _device: device });
	}

	public getCanExecuteAction(platform: string, appIdentifier: string, canExecute: (dev: Mobile.IDevice) => boolean): (dev: Mobile.IDevice) => boolean {
		canExecute = canExecute || ((dev: Mobile.IDevice) => dev.deviceInfo.platform.toLowerCase() === platform.toLowerCase());
		let finalCanExecute = canExecute;
		if (this.$options.device) {
			return (device: Mobile.IDevice): boolean => canExecute(device) && device.deviceInfo.identifier === this.$devicesService.getDeviceByDeviceOption().deviceInfo.identifier;
		}

		if (this.$mobileHelper.isiOSPlatform(platform)) {
			if (this.$options.emulator) {
				finalCanExecute = (device: Mobile.IDevice): boolean => canExecute(device) && this.$devicesService.isiOSSimulator(device);
			} else {
				let devices = this.$devicesService.getDevicesForPlatform(platform);
				let simulator = _.find(devices, d => this.$devicesService.isiOSSimulator(d));
				if (simulator) {
					let iOSDevices = _.filter(devices, d => d.deviceInfo.identifier !== simulator.deviceInfo.identifier);
					if (iOSDevices && iOSDevices.length) {
						let isApplicationInstalledOnSimulator = await  simulator.applicationManager.isApplicationInstalled(appIdentifier);
						let isApplicationInstalledOnAllDevices = await  _.intersection.apply(null, iOSDevices.map(device => device.applicationManager.isApplicationInstalled(appIdentifier)));
						// In case the application is not installed on both device and simulator, syncs only on device.
						if (!isApplicationInstalledOnSimulator && !isApplicationInstalledOnAllDevices) {
							finalCanExecute = (device: Mobile.IDevice): boolean => canExecute(device) && this.$devicesService.isiOSDevice(device);
						}
					}
				}
			}
		}

		return finalCanExecute;
	}
}
$injector.register('liveSyncServiceBase', LiveSyncServiceBase);
