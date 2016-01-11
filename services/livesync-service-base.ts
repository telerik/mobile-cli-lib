///<reference path="../.d.ts"/>
"use strict";

import * as fiberBootstrap from "../fiber-bootstrap";
import syncBatchLib = require("./livesync/sync-batch");
import * as shell from "shelljs";
import * as path from "path";
import * as temp from "temp";
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
		private $hostInfo: IHostInfo) {
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
		gaze("**/*", { cwd: data.syncWorkingDirectory }, function(err: any, watcher: any) {
			this.on('all', (event: string, filePath: string) => {
				fiberBootstrap.run(() => {
					let fileHash = that.$fs.exists(filePath).wait() && that.$fs.getFsStats(filePath).wait().isFile() ? that.$fs.getFileShasum(filePath).wait() : "";
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

					if (event === "added" || event === "changed" || event === "renamed") {
						that.syncAddedOrChangedFile(data, mappedFilePath).wait();
					} else if (event === "deleted") {
						that.fileHashes = <any>(_.omit(that.fileHashes, filePath));
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
				let platformLiveSyncService = this.resolvePlatformLiveSyncService(data.platform, device);
				return platformLiveSyncService.removeFiles(data.appIdentifier, localToDevicePaths);
			};

			this.syncCore(data, [filePath], deviceFilesAction).wait();
		}).future<void>()();
	}

	private syncCore(data: ILiveSyncData, filesToSync?: string[], deviceFilesAction?: (device: Mobile.IDevice, localToDevicePaths: Mobile.ILocalToDevicePathData[]) => IFuture<void>): IFuture<void> {
		return (() => {
			let appIdentifier = data.appIdentifier;
			let platform = data.platform;
			let projectFilesPath = data.projectFilesPath;

			let packageFilePath: string = null;
			let shouldRefreshApplication: boolean;

			let action = (device: Mobile.IDevice) => {
				return (() => {
					shouldRefreshApplication = true;
					let deviceAppData = this.$deviceAppDataFactory.create(appIdentifier, this.$mobileHelper.normalizePlatformName(platform), device);
					if (deviceAppData.isLiveSyncSupported().wait()) {
						let platformLiveSyncService = this.resolvePlatformLiveSyncService(platform, device);

						if (platformLiveSyncService.beforeLiveSyncAction) {
							platformLiveSyncService.beforeLiveSyncAction(deviceAppData).wait();
						}

						// Not installed application
						if (!device.applicationManager.isApplicationInstalled(appIdentifier).wait()) {
							this.$logger.warn(`The application with id "${appIdentifier}" is not installed on device with identifier ${device.deviceInfo.identifier}.`);
							if (!packageFilePath) {
								packageFilePath = this.$liveSyncProvider.buildForDevice(device).wait();
								device.applicationManager.reinstallApplication(appIdentifier, packageFilePath).wait();
								if (device.applicationManager.canStartApplication()) {
									device.applicationManager.startApplication(appIdentifier).wait();
								}
							}
							shouldRefreshApplication =  false;
						}

						// Transfer or remove files on device
						let localToDevicePaths = this.$projectFilesManager.createLocalToDevicePaths(deviceAppData, projectFilesPath, filesToSync, data.excludedProjectDirsAndFiles);
						if (deviceFilesAction) {
							deviceFilesAction(device, localToDevicePaths).wait();
						} else {
							this.transferFiles(deviceAppData, localToDevicePaths, projectFilesPath, !filesToSync).wait();
						}

						// Restart application or reload page
						if (shouldRefreshApplication) {
							this.$logger.info("Applying changes...");
							platformLiveSyncService.refreshApplication(deviceAppData, localToDevicePaths, data.canExecuteFastSync).wait();
							this.$logger.info(`Successfully synced application ${data.appIdentifier} on device ${device.deviceInfo.identifier}.`);
						}
					}
				}).future<void>()();
			};

			let canExecute = this.getCanExecuteAction(platform, appIdentifier);

			this.$devicesService.execute(action, canExecute).wait();
		}).future<void>()();
	}

	private transferFiles(deviceAppData: Mobile.IDeviceAppData, localToDevicePaths: Mobile.ILocalToDevicePathData[], projectFilesPath: string, isFullSync: boolean): IFuture<void> {
		return (() => {
			this.$logger.info("Transferring project files...");
			let canTransferDirectory = isFullSync && (this.$devicesService.isAndroidDevice(deviceAppData.device) || this.$devicesService.isiOSSimulator(deviceAppData.device));
			if (canTransferDirectory) {
				let tempDir = temp.mkdirSync("tempDir");
				shell.cp("-Rf", path.join(projectFilesPath, "*"), tempDir);
				this.$projectFilesManager.processPlatformSpecificFiles(tempDir, deviceAppData.platform).wait();
				deviceAppData.device.fileSystem.transferDirectory(deviceAppData, localToDevicePaths, tempDir).wait();
			} else {
				deviceAppData.device.fileSystem.transferFiles(deviceAppData, localToDevicePaths).wait();
			}
			this.$logger.info("Successfully transferred all project files.");
		}).future<void>()();
	}

	private resolvePlatformLiveSyncService(platform: string, device: Mobile.IDevice): IPlatformLiveSyncService {
		return this.$injector.resolve(this.$liveSyncProvider.platformSpecificLiveSyncServices[platform.toLowerCase()], {_device: device});
	}

	private getCanExecuteAction(platform: string, appIdentifier: string): (dev: Mobile.IDevice) => boolean {
		let canExecute: (dev: Mobile.IDevice) => boolean = null;
		if (this.$options.device) {
			return (device: Mobile.IDevice): boolean => device.deviceInfo.identifier === this.$devicesService.getDeviceByDeviceOption().deviceInfo.identifier;
		}

		if (this.$mobileHelper.isiOSPlatform(platform)) {
			if (this.$options.emulator) {
				canExecute = (device: Mobile.IDevice): boolean => this.$devicesService.isiOSSimulator(device);
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
							canExecute = (device: Mobile.IDevice): boolean => this.$devicesService.isiOSDevice(device);
						}
					}
				}
			}
		}

		return canExecute;
	}
}
$injector.register('liveSyncServiceBase', LiveSyncServiceBase);

