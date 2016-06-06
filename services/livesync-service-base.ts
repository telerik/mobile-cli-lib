import * as fiberBootstrap from "../fiber-bootstrap";
import syncBatchLib = require("./livesync/sync-batch");
import * as shell from "shelljs";
import * as path from "path";
import * as temp from "temp";
import * as minimatch from "minimatch";
import * as constants from "../mobile/constants";
import * as util from "util";

let gaze = require("gaze");

class LiveSyncServiceBase implements ILiveSyncServiceBase {
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

	public getPlatform(platform?: string): IFuture<string> { // gets the platform and ensures that the devicesService is initialized
		return (() => {
			this.$devicesService.initialize({ platform: platform, deviceId: this.$options.device }).wait();
			return platform || this.$devicesService.platform;
		}).future<string>()();
	}

	public sync(data: ILiveSyncData, filePaths?: string[]): IFuture<void> {
		return (() => {
			this.syncCore(data, filePaths).wait();

			if (this.$options.watch) {
				this.$hooksService.executeBeforeHooks('watch').wait();
				this.partialSync(data);
			}
		}).future<void>()();
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

	private partialSync(data: ILiveSyncData): void {
		let that = this;
		gaze("**/*", { cwd: data.syncWorkingDirectory }, function (err: any, watcher: any) {
			this.on('all', (event: string, filePath: string) => {
				fiberBootstrap.run(() => {
					that.$dispatcher.dispatch(() => (() => {
						try {
							if (filePath.indexOf(constants.APP_RESOURCES_FOLDER_NAME) !== -1) {
								that.$logger.warn(`Skipping livesync for changed file ${filePath}. This change requires a full build to update your application. `.yellow.bold);
								return;
							}

							if (that.isFileExcluded(filePath, data.excludedProjectDirsAndFiles)) {
								that.$logger.trace(`Skipping livesync for changed file ${filePath} as it is excluded in the patterns: ${data.excludedProjectDirsAndFiles.join(", ")}`);
								return;
							}

							let fileHash = that.$fs.exists(filePath).wait() && that.$fs.getFsStats(filePath).wait().isFile() ? that.$fs.getFileShasum(filePath).wait() : "";
							if (fileHash === that.fileHashes[filePath]) {
								that.$logger.trace(`Skipping livesync for ${filePath} file with ${fileHash} hash.`);
								return;
							}

							that.$logger.trace(`Adding ${filePath} file with ${fileHash} hash.`);
							that.fileHashes[filePath] = fileHash;

							let mappedFilePath = that.$projectFilesProvider.mapFilePath(filePath, data.platform);
							that.$logger.trace(`Syncing filePath ${filePath}, mappedFilePath is ${mappedFilePath}`);
							if (!mappedFilePath) {
								that.$logger.warn(`Unable to sync ${filePath}.`);
								return;
							}

							data.canExecuteFastSync = data.forceExecuteFullSync ? false : that.$liveSyncProvider.canExecuteFastSync(filePath, data.platform);

							if (event === "added" || event === "changed" || event === "renamed") {
								that.syncAddedOrChangedFile(data, mappedFilePath).wait();
							} else if (event === "deleted") {
								that.fileHashes = <any>(_.omit(that.fileHashes, filePath));
								that.syncRemovedFile(data, mappedFilePath).wait();
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

	private batch: ISyncBatch = null;

	private batchSync(data: ILiveSyncData, filePath: string): void {
		if (!this.batch || !this.batch.syncPending) {
			let done = () => {
				return (() => {
					setTimeout(() => {
						fiberBootstrap.run(() => {
							this.$dispatcher.dispatch(() => (() => {
								try {
									this.$liveSyncProvider.preparePlatformForSync(data.platform).wait();
									this.batch.syncFiles(filesToSync => this.syncCore(data, filesToSync)).wait();
								} catch (err) {
									this.$logger.warn(`Unable to sync files. Error is:`, err.message);
								}
							}).future<void>()());

						});
					}, syncBatchLib.SYNC_WAIT_THRESHOLD);
				}).future<void>()();
			};
			this.batch = this.$injector.resolve(syncBatchLib.SyncBatch, { done: done });
		}

		this.batch.addFile(filePath);
	}

	private fastSync(data: ILiveSyncData, filePath: string): IFuture<void> {
		return (() => {
			this.$liveSyncProvider.preparePlatformForSync(data.platform).wait();
			this.syncCore(data, [filePath]).wait();
		}).future<void>()();
	}

	private syncAddedOrChangedFile(data: ILiveSyncData, filePath: string): IFuture<void> {
		return (() => {
			if (data.canExecuteFastSync) {
				this.fastSync(data, filePath).wait();
			} else {
				this.batchSync(data, filePath);
			}
		}).future<void>()();
	}

	private syncRemovedFile(data: ILiveSyncData, filePath: string): IFuture<void> {
		return (() => {
			let filePathArray = [filePath],
				deviceFilesAction = this.getSyncRemovedFilesAction(data);

			this.syncCore(data, filePathArray, deviceFilesAction).wait();
		}).future<void>()();
	}

	public getSyncRemovedFilesAction(data: ILiveSyncData): (device: Mobile.IDevice, localToDevicePaths: Mobile.ILocalToDevicePathData[]) => IFuture<void> {
		return (device: Mobile.IDevice, localToDevicePaths: Mobile.ILocalToDevicePathData[]) => {
			let platformLiveSyncService = this.resolvePlatformLiveSyncService(data.platform, device);
			return platformLiveSyncService.removeFiles(data.appIdentifier, localToDevicePaths);
		};
	}

	public getSyncAction(data: ILiveSyncData, filesToSync?: string[], deviceFilesAction?: (device: Mobile.IDevice, localToDevicePaths: Mobile.ILocalToDevicePathData[]) => IFuture<void>, liveSyncOptions?: { isForCompanionApp: boolean }): (device: Mobile.IDevice) => IFuture<void> {
		let appIdentifier = data.appIdentifier;
		let platform = data.platform;
		let projectFilesPath = data.projectFilesPath;

		let packageFilePath: string = null;

		let action = (device: Mobile.IDevice): IFuture<void> => {
			return (() => {
				let shouldRefreshApplication = true;
				let deviceAppData = this.$deviceAppDataFactory.create(appIdentifier, this.$mobileHelper.normalizePlatformName(platform), device, liveSyncOptions);
				if (deviceAppData.isLiveSyncSupported().wait()) {
					let platformLiveSyncService = this.resolvePlatformLiveSyncService(platform, device);

					if (platformLiveSyncService.beforeLiveSyncAction) {
						platformLiveSyncService.beforeLiveSyncAction(deviceAppData).wait();
					}

					// Not installed application
					if (!device.applicationManager.isApplicationInstalled(appIdentifier).wait() && !this.$options.companion) {
						this.$logger.warn(`The application with id "${appIdentifier}" is not installed on device with identifier ${device.deviceInfo.identifier}.`);
						if (!packageFilePath) {
							packageFilePath = this.$liveSyncProvider.buildForDevice(device).wait();
						}
						device.applicationManager.installApplication(packageFilePath).wait();
						if (device.applicationManager.canStartApplication()) {
							device.applicationManager.startApplication(appIdentifier).wait();
						}

						if (platformLiveSyncService.afterInstallApplicationAction) {
							let localToDevicePaths = this.$projectFilesManager.createLocalToDevicePaths(deviceAppData, projectFilesPath, filesToSync, data.excludedProjectDirsAndFiles);
							platformLiveSyncService.afterInstallApplicationAction(deviceAppData, localToDevicePaths).wait();
						}
						shouldRefreshApplication = false;
					}

					// Restart application or reload page
					if (shouldRefreshApplication) {
						// Transfer or remove files on device
						let localToDevicePaths = this.$projectFilesManager.createLocalToDevicePaths(deviceAppData, projectFilesPath, filesToSync, data.excludedProjectDirsAndFiles);
						if (deviceFilesAction) {
							deviceFilesAction(device, localToDevicePaths).wait();
						} else {
							this.transferFiles(deviceAppData, localToDevicePaths, projectFilesPath, !filesToSync).wait();
						}

						this.$logger.info("Applying changes...");
						platformLiveSyncService.refreshApplication(deviceAppData, localToDevicePaths, data.canExecuteFastSync).wait();
						this.$logger.info(`Successfully synced application ${data.appIdentifier} on device ${device.deviceInfo.identifier}.`);
					}
				} else {
					throw new Error(`LiveSync is not supported for application: ${deviceAppData.appIdentifier} on device with identifier ${device.deviceInfo.identifier}.`);
				}
			}).future<void>()();
		};

		return action;
	}

	private syncCore(data: ILiveSyncData, filesToSync?: string[], deviceFilesAction?: (device: Mobile.IDevice, localToDevicePaths: Mobile.ILocalToDevicePathData[]) => IFuture<void>): IFuture<void> {
		return (() => {
			let appIdentifier = data.appIdentifier;
			let platform = data.platform;

			let canExecute = this.getCanExecuteAction(platform, appIdentifier, data.canExecute);
			let action = this.getSyncAction(data, filesToSync, deviceFilesAction);

			this.$devicesService.execute(action, canExecute).wait();
		}).future<void>()();
	}

	private transferFiles(deviceAppData: Mobile.IDeviceAppData, localToDevicePaths: Mobile.ILocalToDevicePathData[], projectFilesPath: string, isFullSync: boolean): IFuture<void> {
		return (() => {
			this.logFilesSyncInformation(localToDevicePaths, "Transferring %s.");

			let canTransferDirectory = isFullSync && (this.$devicesService.isAndroidDevice(deviceAppData.device) || this.$devicesService.isiOSSimulator(deviceAppData.device));
			if (canTransferDirectory) {
				let tempDir = temp.mkdirSync("tempDir");
				shell.cp("-Rf", path.join(projectFilesPath, "*"), tempDir);
				this.$projectFilesManager.processPlatformSpecificFiles(tempDir, deviceAppData.platform).wait();
				deviceAppData.device.fileSystem.transferDirectory(deviceAppData, localToDevicePaths, tempDir).wait();
			} else {
				deviceAppData.device.fileSystem.transferFiles(deviceAppData, localToDevicePaths).wait();
			}

			this.logFilesSyncInformation(localToDevicePaths, "Successfully transferred %s.");
		}).future<void>()();
	}

	private logFilesSyncInformation(localToDevicePaths: Mobile.ILocalToDevicePathData[], message: string): void {
		_.each(localToDevicePaths, (file: Mobile.ILocalToDevicePathData) => {
			this.$logger.info(util.format(message, path.basename(file.getLocalPath()).yellow));
		});
	}

	private resolvePlatformLiveSyncService(platform: string, device: Mobile.IDevice): IPlatformLiveSyncService {
		return this.$injector.resolve(this.$liveSyncProvider.platformSpecificLiveSyncServices[platform.toLowerCase()], { _device: device });
	}

	public getCanExecuteAction(platform: string, appIdentifier: string, canExecute: (dev: Mobile.IDevice) => boolean): (dev: Mobile.IDevice) => boolean {
		canExecute = canExecute || ((dev: Mobile.IDevice) => dev.deviceInfo.platform.toLowerCase() === platform.toLowerCase());
		let finalCanExecute = canExecute;
		if (this.$options.device) {
			return (device: Mobile.IDevice): boolean => device.deviceInfo.identifier === this.$devicesService.getDeviceByDeviceOption().deviceInfo.identifier;
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
						let isApplicationInstalledOnSimulator = simulator.applicationManager.isApplicationInstalled(appIdentifier).wait();
						let isApplicationInstalledOnAllDevices = _.intersection.apply(null, iOSDevices.map(device => device.applicationManager.isApplicationInstalled(appIdentifier).wait()));
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
