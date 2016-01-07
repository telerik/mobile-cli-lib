///<reference path="../.d.ts"/>
"use strict";

import * as fiberBootstrap from "../fiber-bootstrap";
let gaze = require("gaze");
import syncBatchLib = require("./livesync/sync-batch");

class LiveSyncServiceBase implements ILiveSyncServiceBase {
	private fileHashes: IDictionary<string>;

	constructor(protected $devicesService: Mobile.IDevicesService,
		protected $mobileHelper: Mobile.IMobileHelper,
		private $localToDevicePathDataFactory: Mobile.ILocalToDevicePathDataFactory,
		protected $logger: ILogger,
		protected $options: ICommonOptions,
		protected $deviceAppDataFactory: Mobile.IDeviceAppDataFactory,
		protected $fs: IFileSystem,
		protected $injector: IInjector,
		protected $childProcess: IChildProcess,
		protected $hooksService: IHooksService,
		protected $hostInfo: IHostInfo,
		private $projectFilesManager: IProjectFilesManager,
		private $projectFilesProvider: IProjectFilesProvider,
		private $liveSyncProvider: ILiveSyncProvider,
		private $devicePlatformsConstants: Mobile.IDevicePlatformsConstants) {
			this.fileHashes = Object.create(null);
		}

	public getPlatform(platform?: string): IFuture<string> { // gets the platform and ensures that the devicesService is initialized
		return (() => {
			this.$devicesService.initialize({ platform: platform, deviceId: this.$options.device }).wait();
			return platform || this.$devicesService.platform;
		}).future<string>()();
	}

	public sync(data: ILiveSyncData): IFuture<void> {
		return (() => {
			this.syncCore(data).wait();

			if (this.$options.watch) {
				this.$hooksService.executeBeforeHooks('watch').wait();
				this.partialSync(data);
			}
		}).future<void>()();
	}

	private partialSync(data: ILiveSyncData): void {
		let that = this;
		gaze("***", { cwd: data.syncWorkingDirectory }, function(err: any, watcher: any) {
			this.on('all', (event: string, filePath: string) => {
				fiberBootstrap.run(() => {
					let fileHash = that.$fs.getFsStats(filePath).wait().isFile() ? that.$fs.getFileShasum(filePath).wait() : "";
					if (fileHash === that.fileHashes[filePath]) {
						that.$logger.trace(`Skipping livesync for ${filePath} file with ${fileHash} hash.`);
						return;
					}

					that.$logger.trace(`Adding ${filePath} file with ${fileHash} hash.`);
					that.fileHashes[filePath] = fileHash;

					that.$liveSyncProvider.preparePlatformForSync(data.platform).wait(); // TODO: this might be moved inside batchSync and fastSync functions

					let mappedFilePath = that.$projectFilesProvider.mapFilePath(filePath, data.platform);
					that.$logger.trace(`Syncing filePath ${filePath}, mappedFilePath is ${mappedFilePath}`);
					if (!mappedFilePath) {
						that.$logger.warn(`Unable to sync ${filePath}.`);
						return;
					}

					data.canExecuteFastSync = that.$liveSyncProvider.canExecuteFastSync(filePath);

					if (event === "added" || event === "changed") {
						that.syncAddedOrChangedFile(data, mappedFilePath).wait();
					} else if (event === "deleted") {
						that.syncRemovedFile(data, mappedFilePath).wait();
					}
				});
			});
		});
	}

	private batch: ISyncBatch = null;

	private batchSync(data: ILiveSyncData, filePath: string): void {
		if (!this.batch || !this.batch.syncPending) {
			let done = () => {
				return (() => {
					setTimeout(() => {
						fiberBootstrap.run(() => {
							this.batch.syncFiles(filesToSync => this.syncCore(data, filesToSync)).wait();
						});
					}, syncBatchLib.SYNC_WAIT_THRESHOLD);
				}).future<void>()();
			};
			this.batch = this.$injector.resolve(syncBatchLib.SyncBatch, { done: done });
		}

		this.batch.addFile(filePath);
	}

	private fastSync(data: ILiveSyncData, filePath: string): IFuture<void> {
		return this.syncCore(data, [filePath]);
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
			let deviceFilesAction = (device: Mobile.IDevice, localToDevicePaths: Mobile.ILocalToDevicePathData[]) => {
				let platformSpecificLiveSyncService = this.resolvePlatformSpecificLiveSyncService(data.platform, device);
				return platformSpecificLiveSyncService.removeFiles(data.appIdentifier, localToDevicePaths);
			};

			this.syncCore(data, [filePath], deviceFilesAction).wait();
		}).future<void>()();
	}

	private syncCore(data: ILiveSyncData, filesToSync?: string[], deviceFilesAction?: (device: Mobile.IDevice, localToDevicePaths: Mobile.ILocalToDevicePathData[]) => IFuture<void>): IFuture<void> {
		return (() => {
			let appIdentifier = data.appIdentifier;
			let platform = data.platform;
			let projectFilesPath = data.projectFilesPath;

			let deviceAppData =  this.$deviceAppDataFactory.create(appIdentifier, this.$mobileHelper.normalizePlatformName(platform));

			let action = (device: Mobile.IDevice) => {
				return (() => {
					if (deviceAppData.isLiveSyncSupported(device).wait()) {
						let platformSpecificLiveSyncService = this.resolvePlatformSpecificLiveSyncService(platform, device);

						if (platformSpecificLiveSyncService.beforeLiveSyncAction) {
							platformSpecificLiveSyncService.beforeLiveSyncAction(deviceAppData).wait();
						}

						// Not installed application
						let applications = device.applicationManager.getInstalledApplications().wait();
						if (!_.contains(applications, appIdentifier)) {
							this.$logger.warn(`The application with id "${appIdentifier}" is not installed on device with identifier ${device.deviceInfo.identifier}.`);
							this.$liveSyncProvider.installOnDevice(platform).wait();
						}

						// Transfer or remove files on device
						let localToDevicePaths = this.$projectFilesManager.createLocalToDevicePaths(platform, appIdentifier, projectFilesPath, filesToSync);
						if (deviceFilesAction) {
							deviceFilesAction(device, localToDevicePaths).wait();
						} else {
							this.transferFiles(device, deviceAppData, localToDevicePaths, projectFilesPath).wait();
						}

						// Restart application or reload page
						this.$logger.info("Applying changes...");
						platformSpecificLiveSyncService.refreshApplication(deviceAppData, data.canExecuteFastSync).wait();
						this.$logger.info(`Successfully synced application ${data.appIdentifier}.`);
					}
				}).future<void>()();
			};

			this.$devicesService.execute(action).wait();
		}).future<void>()();
	}

	private transferFiles(device: Mobile.IDevice, deviceAppData: Mobile.IDeviceAppData, localToDevicePaths: Mobile.ILocalToDevicePathData[], projectFilesPath: string): IFuture<void> {
		return (() => {
			this.$logger.info("Transferring project files...");
			let canTransferDirectory = device.deviceInfo.platform === this.$devicePlatformsConstants.Android || device.deviceInfo.type === "Simulator";
			if (canTransferDirectory) {
				device.fileSystem.transferDirectory(deviceAppData, localToDevicePaths, projectFilesPath).wait();
			} else {
				device.fileSystem.transferFiles(deviceAppData.appIdentifier, localToDevicePaths).wait();
			}
			this.$logger.info("Successfully transferred all project files.");
		}).future<void>()();
	}

	private resolvePlatformSpecificLiveSyncService(platform: string, device: Mobile.IDevice): IPlatformSpecificLiveSyncService {
		return this.$injector.resolve(this.$liveSyncProvider.platformSpecificLiveSyncServices[platform.toLowerCase()], {_device: device});
	}
}
$injector.register('liveSyncServiceBase', LiveSyncServiceBase);

