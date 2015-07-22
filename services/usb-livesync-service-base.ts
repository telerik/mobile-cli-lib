///<reference path="../../.d.ts"/>
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
		protected $options: IOptions,
		private $deviceAppDataFactory: Mobile.IDeviceAppDataFactory,
		private $fs: IFileSystem,
		private $dispatcher: IFutureDispatcher) { }
		
	public initialize(platform: string): IFuture<string> {
		return (() => {
			this.$devicesServices.initialize({ platform: platform, deviceId: this.$options.device }).wait();
			this._initialized = true;
			return this.$devicesServices.platform;			
		}).future<string>()();
	}	
		
	public sync(platform: string, appIdentifier: string, localProjectRootPath: string, projectFilesPath: string, excludedProjectDirsAndFiles: string[], watchGlob: any,
		restartAppOnDeviceAction: (device: Mobile.IDevice, deviceAppData: Mobile.IDeviceAppData, localToDevicePaths?: Mobile.ILocalToDevicePathData[]) => IFuture<void>,
		notInstalledAppOnDeviceAction: (device: Mobile.IDevice) => IFuture<void>,
		beforeBatchLiveSyncAction?: (filePath: string) => IFuture<string>,
		canLiveSyncAction?: (device: Mobile.IDevice, appIdentifier: string) => IFuture<boolean>): IFuture<void> {
		return (() => {
			if(!this._initialized) {
				this.initialize(platform).wait();
			}
			
			let projectFiles = this.$fs.enumerateFilesInDirectorySync(projectFilesPath, (filePath, stat) => !this.isFileExcluded(path.relative(projectFilesPath, filePath), excludedProjectDirsAndFiles, projectFilesPath), { enumerateDirectories: true});
			this.syncCore(projectFiles, appIdentifier, localProjectRootPath, restartAppOnDeviceAction, notInstalledAppOnDeviceAction, canLiveSyncAction).wait();
			
			if(this.$options.watch) {
				let __this = this;
				
				gaze(watchGlob, function(err: any, watcher: any) {
					this.on('changed', (filePath: string) => {
						if(!_.contains(excludedProjectDirsAndFiles, filePath)) {
							__this.batchLiveSync(filePath, appIdentifier, localProjectRootPath, restartAppOnDeviceAction, notInstalledAppOnDeviceAction, beforeBatchLiveSyncAction);
						}
					});
				});
				
				this.$dispatcher.run();
			} 
		}).future<void>()();
	}
	
	private syncCore(projectFiles: string[], appIdentifier: string, localProjectRootPath: string, 
		restartAppOnDeviceAction: (device: Mobile.IDevice, deviceAppData: Mobile.IDeviceAppData, localToDevicePaths?: Mobile.ILocalToDevicePathData[]) => IFuture<void>,
		notInstalledAppOnDeviceAction: (device: Mobile.IDevice) => IFuture<void>,
		canLiveSyncAction: (device: Mobile.IDevice, appIdentifier: string) => IFuture<boolean>): IFuture<void> {
		return (() => {
			let deviceAppData = this.$deviceAppDataFactory.create(appIdentifier, this.$devicesServices.platform);
			let localToDevicePaths = _(projectFiles)
				.map(projectFile => this.getProjectFileInfo(projectFile))
				.filter(projectFileInfo => projectFileInfo.shouldIncludeFile)
				.map(projectFileInfo => this.$localToDevicePathDataFactory.create(projectFileInfo.fileName, localProjectRootPath, projectFileInfo.onDeviceName, deviceAppData.deviceProjectRootPath))
				.value();	
				
			let action = (device: Mobile.IDevice) => {
				return (() => { 
					if(deviceAppData.isLiveSyncSupported(device).wait()) {
						let applications = device.applicationManager.getInstalledApplications().wait();
						if(!_.contains(applications, deviceAppData.appIdentifier)) {
							this.$logger.warn(`The application with id "${deviceAppData.appIdentifier}" is not installed on the device yet.`);
							notInstalledAppOnDeviceAction(device).wait();
							return;
						}
						
						if(canLiveSyncAction && !canLiveSyncAction(device, appIdentifier).wait()) {
							return;
						}
						
						this.$logger.info("Transfering project files...");
						device.fileSystem.transferFiles(deviceAppData.appIdentifier, localToDevicePaths).wait();
						this.$logger.info("Successfully transfered all project files.");
						
						this.$logger.info("Applying changes...");
						restartAppOnDeviceAction(device, deviceAppData, localToDevicePaths).wait();
						this.$logger.info(`Successfully synced application ${deviceAppData.appIdentifier} on device ${device.deviceInfo.identifier}.`);
					}
				}).future<void>()();
			}
			
			this.$devicesServices.execute(action).wait();
		}).future<void>()();
	}

	private timer: any= null;
	private syncQueue: string[] = [];
	private batchLiveSync(filePath: string, appIdentifier: string, localProjectRootPath: string, 
		restartAppOnDeviceAction: (device: Mobile.IDevice, deviceAppData: Mobile.IDeviceAppData, localToDevicePaths?: Mobile.ILocalToDevicePathData[]) => IFuture<void>,
		notInstalledAppOnDeviceAction: (device: Mobile.IDevice) => IFuture<void>,
		beforeBatchLiveSyncAction?: (filePath: string) => IFuture<string>,
		canLiveSyncAction?: (device: Mobile.IDevice, appIdentifier: string) => IFuture<boolean>) : void {
		if(!this.timer) {
			this.timer = setInterval(() => {
				let filesToSync = this.syncQueue;
				if(filesToSync.length > 0) {
					this.syncQueue = [];
					this.$logger.trace("Syncing %s", filesToSync.join(", "));
					this.$dispatcher.dispatch( () => {
						return (() => {
							this.syncCore(filesToSync, appIdentifier, localProjectRootPath, restartAppOnDeviceAction, notInstalledAppOnDeviceAction, canLiveSyncAction).wait();
						}).future<void>()();
					});
				}
			}, 500);
		}
		this.$dispatcher.dispatch( () => (() => { this.syncQueue.push(beforeBatchLiveSyncAction(filePath).wait()) }).future<void>()());
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
}