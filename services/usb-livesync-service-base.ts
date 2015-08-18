///<reference path="../.d.ts"/>
"use strict";

import helpers = require("./../helpers");
import minimatch = require("minimatch");
import path = require("path");
import util = require("util");

let gaze = require("gaze");

interface IProjectFileInfo {
	fileName: string;
	onDeviceName: string;
	shouldIncludeFile: boolean;
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
		restartAppOnDeviceAction: (device: Mobile.IDevice, deviceAppData: Mobile.IDeviceAppData, localToDevicePaths?: Mobile.ILocalToDevicePathData[]) => IFuture<void>,
		notInstalledAppOnDeviceAction: (device: Mobile.IDevice) => IFuture<void>,
		notRunningiOSSimulatorAction: () => IFuture<void>,
		localProjectRootPath?: string,
		beforeLiveSyncAction?: (device: Mobile.IDevice, deviceAppData: Mobile.IDeviceAppData) => IFuture<void>,
		beforeBatchLiveSyncAction?: (filePath: string) => IFuture<string>,
		iOSSimulatorRelativeToProjectBasePathAction?: (projectFile: string) => string): IFuture<void> {
		return (() => {
			let synciOSSimulator = this.$hostInfo.isDarwin ? this.$iOSEmulatorServices.isSimulatorRunning().wait() || (this.$options.emulator && platform.toLowerCase() === "ios") : false;
			
			if(synciOSSimulator) {
				this.$iOSEmulatorServices.sync(appIdentifier, projectFilesPath, notRunningiOSSimulatorAction).wait();
			}
			
			if(!this._initialized && (!this.$options.emulator || platform.toLowerCase() === "android")) {
				this.initialize(platform).wait();
			}
			
			if(!this.$options.emulator || platform.toLowerCase() === "android") {
				let projectFiles = this.$fs.enumerateFilesInDirectorySync(projectFilesPath, (filePath, stat) => !this.isFileExcluded(path.relative(projectFilesPath, filePath), excludedProjectDirsAndFiles, projectFilesPath), { enumerateDirectories: true});
				this.syncCore(platform, projectFiles, appIdentifier, localProjectRootPath || projectFilesPath, platformSpecificLiveSyncServices, restartAppOnDeviceAction, notInstalledAppOnDeviceAction, beforeLiveSyncAction).wait();
			}
			
			if(this.$options.watch) {
				let __this = this;
				
				gaze("**/*", { cwd: watchGlob }, function(err: any, watcher: any) {
					this.on('all', (event: string, filePath: string) => {
						if(event === "added" || event === "changed") {
							if(!_.contains(excludedProjectDirsAndFiles, filePath)) {
								if(synciOSSimulator) {
									__this.$dispatcher.dispatch(() => __this.$iOSEmulatorServices.syncFiles(appIdentifier, projectFilesPath, [filePath], notRunningiOSSimulatorAction, iOSSimulatorRelativeToProjectBasePathAction)); 
								}
								
								if(!__this.$options.emulator || platform.toLowerCase() === "android") {
									__this.batchLiveSync(platform, filePath, appIdentifier, localProjectRootPath || projectFilesPath,  platformSpecificLiveSyncServices, restartAppOnDeviceAction, notInstalledAppOnDeviceAction, beforeLiveSyncAction, beforeBatchLiveSyncAction);
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
		restartAppOnDeviceAction: (device: Mobile.IDevice, deviceAppData: Mobile.IDeviceAppData, localToDevicePaths?: Mobile.ILocalToDevicePathData[]) => IFuture<void>,
		notInstalledAppOnDeviceAction: (device: Mobile.IDevice) => IFuture<void>,
		beforeLiveSyncAction?: (device: Mobile.IDevice, deviceAppData: Mobile.IDeviceAppData) => IFuture<void>): IFuture<void> {
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
							notInstalledAppOnDeviceAction(device).wait();
							return;
						}
						
						this.$logger.info("Transferring project files...");
						device.fileSystem.transferFiles(deviceAppData.appIdentifier, localToDevicePaths).wait();
						this.$logger.info("Successfully transferred all project files.");
						
						this.$logger.info("Applying changes...");
						let platformSpecificLiveSyncService = this.resolvePlatformSpecificLiveSyncService(platform, device, platformSpecificLiveSyncServices)
						platformSpecificLiveSyncService.restartApplication(deviceAppData, localToDevicePaths).wait();
						this.$logger.info(`Successfully synced application ${deviceAppData.appIdentifier}.`);
					}
				}).future<void>()();
			}
			
			this.$devicesServices.execute(action).wait();
		}).future<void>()();
	}

	private timer: any= null;
	private syncQueue: string[] = [];
	private batchLiveSync(platform: string, filePath: string, appIdentifier: string, projectFilesPath: string, 
		platformSpecificLiveSyncServices: IDictionary<any>,
		restartAppOnDeviceAction: (device: Mobile.IDevice, deviceAppData: Mobile.IDeviceAppData, localToDevicePaths?: Mobile.ILocalToDevicePathData[]) => IFuture<void>,
		notInstalledAppOnDeviceAction: (device: Mobile.IDevice) => IFuture<void>,
		beforeLiveSyncAction?: (device: Mobile.IDevice, deviceAppData: Mobile.IDeviceAppData) => IFuture<void>,
		beforeBatchLiveSyncAction?: (filePath: string) => IFuture<string>) : void {
		if(!this.timer) {
			this.timer = setInterval(() => {
				let filesToSync = this.syncQueue;
				if(filesToSync.length > 0) {
					this.syncQueue = [];
					this.$logger.trace("Syncing %s", filesToSync.join(", "));
					this.$dispatcher.dispatch( () => {
						return (() => {
							this.syncCore(platform, filesToSync, appIdentifier, projectFilesPath, platformSpecificLiveSyncServices, restartAppOnDeviceAction, notInstalledAppOnDeviceAction, beforeLiveSyncAction).wait();
						}).future<void>()();
					});
				}
			}, 500);
		}

		this.$dispatcher.dispatch( () => (() => { this.syncQueue.push(beforeBatchLiveSyncAction ? beforeBatchLiveSyncAction(filePath).wait() : filePath) }).future<void>()());
	} 
	
	private isFileExcluded(path: string, exclusionList: string[], projectDir: string): boolean {
		return !!_.find(exclusionList, (pattern) => minimatch(path, pattern, { nocase: true }));
	}
		
	private getProjectFileInfo(fileName: string): IProjectFileInfo {
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