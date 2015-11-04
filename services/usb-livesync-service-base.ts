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

	constructor(protected $devicesService: Mobile.IDevicesService,
		protected $mobileHelper: Mobile.IMobileHelper,
		private $localToDevicePathDataFactory: Mobile.ILocalToDevicePathDataFactory,
		protected $logger: ILogger,
		protected $options: ICommonOptions,
		protected $deviceAppDataFactory: Mobile.IDeviceAppDataFactory,
		private $fs: IFileSystem,
		protected $dispatcher: IFutureDispatcher,
		protected $injector: IInjector,
		protected $childProcess: IChildProcess,
		protected $iOSEmulatorServices: Mobile.IiOSSimulatorService,
		protected $hooksService: IHooksService,
		protected $hostInfo: IHostInfo) { }

	public initialize(platform: string): IFuture<string> {
		return (() => {
			if(!(this.$options.emulator && platform && platform.toLowerCase() === "ios")) {
				this.$devicesService.initialize({ platform: platform, deviceId: this.$options.device }).wait();
				this._initialized = true;
				return this.$devicesService.platform;
			}
		}).future<string>()();
	}

	public get isInitialized(): boolean {
		return this._initialized;
	}

	public sync(data: ILiveSyncData): IFuture<void> {
		return (() => {
			let synciOSSimulator = this.shouldSynciOSSimulator(data.platform).wait();

			if(synciOSSimulator) {
				this.$iOSEmulatorServices.sync(data.appIdentifier, data.projectFilesPath, data.notRunningiOSSimulatorAction).wait();
			}

			if(!this._initialized && (!this.$options.emulator || data.platform.toLowerCase() === "android")) {
				this.initialize(data.platform).wait();
			}

			if(!this.$options.emulator || data.platform.toLowerCase() === "android") {
				let projectFiles = this.$fs.enumerateFilesInDirectorySync(data.projectFilesPath,
					(filePath, stat) => !this.isFileExcluded(path.relative(data.projectFilesPath, filePath), data.excludedProjectDirsAndFiles, data.projectFilesPath),
					{ enumerateDirectories: true }
				);

				this.syncCore(data, projectFiles).wait();
			}

			if(this.$options.watch) {

				let that = this;
				this.$hooksService.executeBeforeHooks('watch').wait();

				gaze("**/*", { cwd: data.watchGlob }, function(err: any, watcher: any) {
					this.on('all', (event: string, filePath: string) => {
						if(event === "added" || event === "changed") {
							if(!that.isFileExcluded(filePath, data.excludedProjectDirsAndFiles, data.projectFilesPath)) {
								let canExecuteFastLiveSync = data.canExecuteFastLiveSync && data.canExecuteFastLiveSync(filePath);

								if(synciOSSimulator) {
									that.batchSimulatorLiveSync(data, filePath);
								}

								if( (!that.$options.emulator || data.platform.toLowerCase() === "android") && !canExecuteFastLiveSync) {
									that.batchLiveSync(data, filePath);
								}

								if (canExecuteFastLiveSync) {
									data.fastLiveSync(filePath);
								}
							}
						}
					});
				});

				this.$dispatcher.run();
			}
		}).future<void>()();
	}

	protected shouldSynciOSSimulator(platform: string): IFuture<boolean> {
		return (() => {
			return this.$hostInfo.isDarwin && platform.toLowerCase() === "ios" && (this.$options.emulator || this.$iOSEmulatorServices.isSimulatorRunning().wait());
		}).future<boolean>()();
	}

	protected createLocalToDevicePaths(platform: string, appIdentifier: string, projectFilesPath: string, projectFiles: string[]): Mobile.ILocalToDevicePathData[] {
		let deviceAppData =  this.$deviceAppDataFactory.create(appIdentifier, this.$mobileHelper.normalizePlatformName(platform));
		let localToDevicePaths = _(projectFiles)
			.map(projectFile => this.getProjectFileInfo(projectFile))
			.filter(projectFileInfo => projectFileInfo.shouldIncludeFile)
			.map(projectFileInfo => this.$localToDevicePathDataFactory.create(projectFileInfo.fileName, projectFilesPath, projectFileInfo.onDeviceName, deviceAppData.deviceProjectRootPath))
			.value();

		return localToDevicePaths;
	}

	protected transferFiles(device: Mobile.IDevice, deviceAppData: Mobile.IDeviceAppData, localToDevicePaths: Mobile.ILocalToDevicePathData[]): IFuture<void> {
		return (() => {
			this.$logger.info("Transferring project files...");
			device.fileSystem.transferFiles(deviceAppData.appIdentifier, localToDevicePaths).wait();
			this.$logger.info("Successfully transferred all project files.");
		}).future<void>()();
	}

	private syncCore(data: ILiveSyncData, projectFiles: string[]): IFuture<void> {
		return (() => {
			let platform = data.platform ? this.$mobileHelper.normalizePlatformName(data.platform) : this.$devicesService.platform;
			let deviceAppData =  this.$deviceAppDataFactory.create(data.appIdentifier, this.$mobileHelper.normalizePlatformName(data.platform));
			let localToDevicePaths = this.createLocalToDevicePaths(data.platform, data.appIdentifier, data.localProjectRootPath || data.projectFilesPath, projectFiles);

			console.log(localToDevicePaths[0]);

			let action = (device: Mobile.IDevice) => {
				return (() => {
					if(deviceAppData.isLiveSyncSupported(device).wait()) {

						if(data.beforeLiveSyncAction) {
							data.beforeLiveSyncAction(device, deviceAppData).wait();
						}

						let applications = device.applicationManager.getInstalledApplications().wait();
						if(!_.contains(applications, deviceAppData.appIdentifier)) {
							this.$logger.warn(`The application with id "${deviceAppData.appIdentifier}" is not installed on the device yet.`);
							if (!data.notInstalledAppOnDeviceAction(device).wait()) {
								return;
							}
						}

						this.transferFiles(device, deviceAppData, localToDevicePaths).wait();

						this.$logger.info("Applying changes...");
						let platformSpecificLiveSyncService = this.resolvePlatformSpecificLiveSyncService(platform, device, data.platformSpecificLiveSyncServices);
						platformSpecificLiveSyncService.restartApplication(deviceAppData, localToDevicePaths).wait();

						this.$logger.info(`Successfully synced application ${deviceAppData.appIdentifier}.`);
					}
				}).future<void>()();
			};

			this.$devicesService.execute(action).wait();
		}).future<void>()();
	}

	private batch: SyncBatch = null;

	private batchLiveSync(data: ILiveSyncData, filePath: string) : void {
			if (!this.batch || !this.batch.syncPending) {
				this.batch = new SyncBatch(
					this.$logger, this.$dispatcher, (filesToSync) => {
						this.preparePlatformForSync(data.platform);
						this.syncCore(data, filesToSync).wait();
					}
				);
			}

		this.$dispatcher.dispatch( () => (() => {
			let fileToSync = data.beforeBatchLiveSyncAction ? data.beforeBatchLiveSyncAction(filePath).wait() : filePath;
			if(fileToSync) {
				this.batch.addFile(fileToSync);
			}
		}).future<void>()());
	}

	private batchSimulatorLiveSync(data: ILiveSyncData, filePath: string): void {
			if (!this.batch || !this.batch.syncPending) {
				this.batch = new SyncBatch(
					this.$logger, this.$dispatcher, (filesToSync) => {
						this.$iOSEmulatorServices.syncFiles(data.appIdentifier, data.projectFilesPath, filesToSync, data.notRunningiOSSimulatorAction, data.iOSSimulatorRelativeToProjectBasePathAction);
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
		let parsed = this.parseFile(fileName, this.$mobileHelper.platformNames, this.$devicesService.platform);
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

	protected resolvePlatformSpecificLiveSyncService(platform: string, device: Mobile.IDevice, platformSpecificLiveSyncServices: IDictionary<any>): IPlatformSpecificUsbLiveSyncService {
		return this.$injector.resolve(platformSpecificLiveSyncServices[platform.toLowerCase()], {_device: device});
	}
}
$injector.register('usbLiveSyncServiceBase', UsbLiveSyncServiceBase);
