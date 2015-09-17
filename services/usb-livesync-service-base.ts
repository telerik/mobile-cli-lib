///<reference path="../.d.ts"/>
"use strict";

import minimatch = require("minimatch");
import * as path from "path";
import * as util from "util";
let gaze = require("gaze");

interface IProjectFileInfo {
	fileName: string;
	onDeviceName: string;
	shouldIncludeFile: boolean;
}

class SyncBatch {
	private timer: NodeJS.Timer = null;
	private syncQueue: string[] = [];

	constructor(
		private $logger: ILogger,
		private $dispatcher: IFutureDispatcher,
		private done: (filesToSync: Array<string>) => void) {
		}

		public addFile(filePath: string): void {
			if (this.timer) {
				clearTimeout(this.timer);
			}

			this.syncQueue.push(filePath);

			this.timer = setTimeout(() => {
				let filesToSync = this.syncQueue;
				if (filesToSync.length > 0) {
					this.syncQueue = [];
					this.$logger.trace("Syncing %s", filesToSync.join(", "));
					this.$dispatcher.dispatch( () => {
						return (() => this.done(filesToSync)).future<void>()();
					});
				}
				this.timer = null;
			}, 500);
		}

		public get syncPending() {
			return this.syncQueue.length > 0;
		}
}

export class UsbLiveSyncServiceBase implements IUsbLiveSyncServiceBase {
	private _initialized = false;

	constructor(protected $devicesServices: Mobile.IDevicesServices,
		protected $mobileHelper: Mobile.IMobileHelper,
		private $localToDevicePathDataFactory: Mobile.ILocalToDevicePathDataFactory,
		protected $logger: ILogger,
		protected $options: ICommonOptions,
		private $deviceAppDataFactory: Mobile.IDeviceAppDataFactory,
		private $fs: IFileSystem,
		private $dispatcher: IFutureDispatcher,
		protected $injector: IInjector,
		protected $childProcess: IChildProcess,
		protected $iOSEmulatorServices: Mobile.IiOSSimulatorService,
		private $hostInfo: IHostInfo) { }

	public initialize(platform: string): IFuture<string> {
		return (() => {
			if(!(this.$options.emulator && platform && platform.toLowerCase() === "ios")) {
				this.$devicesServices.initialize({ platform: platform, deviceId: this.$options.device }).wait();
				this._initialized = true;
				return this.$devicesServices.platform;
			}
		}).future<string>()();
	}

	public sync(platform: string, appIdentifier: string, projectFilesPath: string, excludedProjectDirsAndFiles: string[], watchGlob: any,
		platformSpecificLiveSyncServices: IDictionary<any>,
		notInstalledAppOnDeviceAction: (_device1: Mobile.IDevice) => IFuture<boolean>,
		notRunningiOSSimulatorAction: () => IFuture<void>,
		localProjectRootPath?: string,
		beforeLiveSyncAction?: (_device2: Mobile.IDevice, _deviceAppData: Mobile.IDeviceAppData) => IFuture<void>,
		beforeBatchLiveSyncAction?: (_filePath: string) => IFuture<string>,
		iOSSimulatorRelativeToProjectBasePathAction?: (projectFile: string) => string): IFuture<void> {
		return (() => {
			let platformLowerCase = platform.toLowerCase();
			let synciOSSimulator = this.$hostInfo.isDarwin && platformLowerCase === "ios" && (this.$options.emulator || this.$iOSEmulatorServices.isSimulatorRunning().wait());

			if(synciOSSimulator) {
				this.$iOSEmulatorServices.sync(appIdentifier, projectFilesPath, notRunningiOSSimulatorAction).wait();
			}

			if(!this._initialized && (!this.$options.emulator || platform.toLowerCase() === "android")) {
				this.initialize(platform).wait();
			}

			if(!this.$options.emulator || platform.toLowerCase() === "android") {
				let projectFiles = this.$fs.enumerateFilesInDirectorySync(projectFilesPath,
					(filePath, stat) => !this.isFileExcluded(path.relative(projectFilesPath, filePath), excludedProjectDirsAndFiles, projectFilesPath),
					{ enumerateDirectories: true }
				);
				this.syncCore(platform, projectFiles, appIdentifier, localProjectRootPath || projectFilesPath, platformSpecificLiveSyncServices, notInstalledAppOnDeviceAction, beforeLiveSyncAction).wait();
			}

			if(this.$options.watch) {
				let that = this;
				gaze("**/*", { cwd: watchGlob }, function(err: any, watcher: any) {
					this.on('all', (event: string, filePath: string) => {
						if(event === "added" || event === "changed") {
							if(!_.contains(excludedProjectDirsAndFiles, filePath)) {
								if(synciOSSimulator) {
									that.batchSimulatorLiveSync(
										appIdentifier,
										projectFilesPath,
										filePath,
										notRunningiOSSimulatorAction,
										iOSSimulatorRelativeToProjectBasePathAction
									);
								}

								if(!that.$options.emulator || platform.toLowerCase() === "android") {
									that.batchLiveSync(
										platform,
										filePath,
										appIdentifier,
										localProjectRootPath || projectFilesPath,
										platformSpecificLiveSyncServices,
										notInstalledAppOnDeviceAction,
										beforeLiveSyncAction,
										beforeBatchLiveSyncAction
									);
								}
							}
						}
					});
				});

				this.$dispatcher.run();
			}
		}).future<void>()();
	}

	private syncCore(platform: string, projectFiles: string[], appIdentifier: string, projectFilesPath: string,
		platformSpecificLiveSyncServices: IDictionary<any>,
		notInstalledAppOnDeviceAction: (_device1: Mobile.IDevice) => IFuture<boolean>,
		beforeLiveSyncAction?: (_device2: Mobile.IDevice, _deviceAppData1: Mobile.IDeviceAppData) => IFuture<void>): IFuture<void> {
		return (() => {
			platform = platform ? this.$mobileHelper.normalizePlatformName(platform) : this.$devicesServices.platform;
			let deviceAppData = this.$deviceAppDataFactory.create(appIdentifier, platform);
			let localToDevicePaths = _(projectFiles)
				.map(projectFile => this.getProjectFileInfo(projectFile))
				.filter(projectFileInfo => projectFileInfo.shouldIncludeFile)
				.map(projectFileInfo => this.$localToDevicePathDataFactory.create(projectFileInfo.fileName, projectFilesPath, projectFileInfo.onDeviceName, deviceAppData.deviceProjectRootPath))
				.value();

			let action = (device: Mobile.IDevice) => {
				return (() => {
					if(deviceAppData.isLiveSyncSupported(device).wait()) {

						if(beforeLiveSyncAction) {
							beforeLiveSyncAction(device, deviceAppData).wait();
						}

						let applications = device.applicationManager.getInstalledApplications().wait();
						if(!_.contains(applications, deviceAppData.appIdentifier)) {
							this.$logger.warn(`The application with id "${deviceAppData.appIdentifier}" is not installed on the device yet.`);
							if (!notInstalledAppOnDeviceAction(device).wait()) {
								return;
							}
						}

						this.$logger.info("Transferring project files...");
						device.fileSystem.transferFiles(deviceAppData.appIdentifier, localToDevicePaths).wait();
						this.$logger.info("Successfully transferred all project files.");

						if (!this.$options.debugBrk) {
							this.$logger.info("Applying changes...");
							let platformSpecificLiveSyncService = this.resolvePlatformSpecificLiveSyncService(platform, device, platformSpecificLiveSyncServices);
							platformSpecificLiveSyncService.restartApplication(deviceAppData, localToDevicePaths).wait();
						}
						this.$logger.info(`Successfully synced application ${deviceAppData.appIdentifier}.`);
					}
				}).future<void>()();
			};

			this.$devicesServices.execute(action).wait();
		}).future<void>()();
	}

	private batch: SyncBatch = null;

	private batchLiveSync(platform: string, filePath: string, appIdentifier: string, projectFilesPath: string,
		platformSpecificLiveSyncServices: IDictionary<any>,
		notInstalledAppOnDeviceAction: (_device: Mobile.IDevice) => IFuture<boolean>,
		beforeLiveSyncAction?: (_device1: Mobile.IDevice, _deviceAppData: Mobile.IDeviceAppData) => IFuture<void>,
		beforeBatchLiveSyncAction?: (_filePath: string) => IFuture<string>) : void {
			if (!this.batch || !this.batch.syncPending) {
				this.batch = new SyncBatch(
					this.$logger, this.$dispatcher, (filesToSync) => {
						this.preparePlatformForSync(platform);
						this.syncCore(
							platform,
							filesToSync,
							appIdentifier,
							projectFilesPath,
							platformSpecificLiveSyncServices,
							notInstalledAppOnDeviceAction,
							beforeLiveSyncAction
						).wait();
					}
				);
			}

		this.$dispatcher.dispatch( () => (() => {
			let fileToSync = beforeBatchLiveSyncAction ? beforeBatchLiveSyncAction(filePath).wait() : filePath;
			if(fileToSync) {
				this.batch.addFile(fileToSync);
			}
		}).future<void>()());
	}

	private batchSimulatorLiveSync(
		appIdentifier: string,
		projectFilesPath: string,
		filePath: string,
		notRunningiOSSimulatorAction: () => IFuture<void>,
		iOSSimulatorRelativeToProjectBasePathAction:(projectFile: string) => string): void {
			if (!this.batch || !this.batch.syncPending) {
				this.batch = new SyncBatch(
					this.$logger, this.$dispatcher, (filesToSync) => {
						this.$iOSEmulatorServices.syncFiles(appIdentifier, projectFilesPath, filesToSync, notRunningiOSSimulatorAction, iOSSimulatorRelativeToProjectBasePathAction);
					}
				);
			}

			this.batch.addFile(filePath);
		}

		protected preparePlatformForSync(platform: string) {
			//Overridden in platform-specific services.
		}

	private isFileExcluded(path: string, exclusionList: string[], projectDir: string): boolean {
		return !!_.find(exclusionList, (pattern) => minimatch(path, pattern, { nocase: true }));
	}

	protected getProjectFileInfo(fileName: string): IProjectFileInfo {
		let parsed = this.parseFile(fileName, this.$mobileHelper.platformNames, this.$devicesServices.platform);
		if(!parsed) {
			parsed = this.parseFile(fileName, ["debug", "release"], "debug"); // TODO: This should be refactored !!!!
		}

		return parsed || {
			fileName: fileName,
			onDeviceName: fileName,
			shouldIncludeFile: true
		};
	}

	private parseFile(fileName: string, validValues: string[], value: string): any {
		let regex = util.format("^(.+?)[.](%s)([.].+?)$", validValues.join("|"));
		let parsed = fileName.match(new RegExp(regex, "i"));
		if(parsed) {
			return {
				fileName: fileName,
				onDeviceName: parsed[1] + parsed[3],
				shouldIncludeFile: parsed[2].toLowerCase() === value.toLowerCase(),
				value: value
			};
		}

		return undefined;
	}

	private resolvePlatformSpecificLiveSyncService(platform: string, device: Mobile.IDevice, platformSpecificLiveSyncServices: IDictionary<any>): IPlatformSpecificLiveSyncService {
		return this.$injector.resolve(platformSpecificLiveSyncServices[platform.toLowerCase()], {_device: device});
	}
}
$injector.register('usbLiveSyncServiceBase', UsbLiveSyncServiceBase);
