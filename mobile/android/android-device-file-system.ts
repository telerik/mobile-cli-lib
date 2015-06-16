///<reference path="../../../.d.ts"/>
"use strict";

import path = require("path");

export class AndroidDeviceFileSystem implements Mobile.IDeviceFileSystem {
	constructor(private adb: Mobile.IAndroidDebugBridge,		
		private identifier: string,
		private $fs: IFileSystem,
		private $logger: ILogger) { }
	
	public listFiles(devicePath: string): IFuture<void> {
		return (() => { }).future<void>()();
	}

	public getFile(deviceFilePath: string): IFuture<void> {
		return (() => { }).future<void>()();
	}

	public putFile(localFilePath: string, deviceFilePath: string): IFuture<void> {
		return (() => { }).future<void>()();
	}
	
	public transferFiles(appIdentifier: string, localToDevicePaths: Mobile.ILocalToDevicePathData[]): IFuture<void> {
		return (() => {
			_.each(localToDevicePaths, (localToDevicePathData) => this.transferFile(localToDevicePathData.getLocalPath(), localToDevicePathData.getDevicePath()).wait());
		}).future<void>()();
	}

	public transferFile(localPath: string, devicePath: string): IFuture<void> {
		return (() => {
			this.$logger.trace(`Transfering ${localPath} to ${devicePath}`);
			let stats = this.$fs.getFsStats(localPath).wait();
			if(stats.isDirectory()) {
				this.adb.executeShellCommand(`mkdir "${path.dirname(devicePath)}"`).wait();
			} else {
				this.adb.executeCommand(`push "${localPath}" "${devicePath}"`).wait(); 
			}
		}).future<void>()();
	}
}