///<reference path="../../.d.ts"/>
"use strict";

import * as path from "path";
import future = require("fibers/future");

export class AndroidDeviceFileSystem implements Mobile.IDeviceFileSystem {
	constructor(private adb: Mobile.IAndroidDebugBridge,
		private identifier: string,
		private $fs: IFileSystem,
		private $logger: ILogger,
		private $deviceAppDataFactory: Mobile.IDeviceAppDataFactory) { }

	public listFiles(devicePath: string): IFuture<void> {
		return future.fromResult();
	}

	public getFile(deviceFilePath: string): IFuture<void> {
		return future.fromResult();
	}

	public putFile(localFilePath: string, deviceFilePath: string): IFuture<void> {
		return future.fromResult();
	}

	public transferFiles(appIdentifier: string, localToDevicePaths: Mobile.ILocalToDevicePathData[],  projectFilesPath?: string): IFuture<void> {
		return (() => {
			_(localToDevicePaths)
				.filter(localToDevicePathData => this.$fs.getFsStats(localToDevicePathData.getLocalPath()).wait().isFile())
				.each(localToDevicePathData =>
					this.adb.executeCommand(["push", localToDevicePathData.getLocalPath(), localToDevicePathData.getDevicePath()]).wait()
				)
				.value();

			_(localToDevicePaths)
				.filter(localToDevicePathData => this.$fs.getFsStats(localToDevicePathData.getLocalPath()).wait().isDirectory())
				.each(localToDevicePathData =>
					this.adb.executeShellCommand(["chmod", "0777", localToDevicePathData.getDevicePath()]).wait()
				)
				.value();
		}).future<void>()();
	}

	public transferDirectory(deviceAppData: Mobile.IDeviceAppData, localToDevicePaths: Mobile.ILocalToDevicePathData[], projectFilesPath: string): IFuture<void> {
		return (() => {
			this.adb.executeCommand(["push", projectFilesPath, deviceAppData.deviceProjectRootPath]).wait();

			let command = _.map(localToDevicePaths, (localToDevicePathData) => localToDevicePathData.getDevicePath()).join(" ");
			this.adb.executeCommand(["chmod", "0777", command]).wait();
		}).future<void>()();
	}

	public transferFile(localPath: string, devicePath: string): IFuture<void> {
		return (() => {
			this.$logger.trace(`Transfering ${localPath} to ${devicePath}`);
			let stats = this.$fs.getFsStats(localPath).wait();
			if(stats.isDirectory()) {
				this.adb.executeShellCommand(["mkdir", path.dirname(devicePath)]).wait();
			} else {
				this.adb.executeCommand(["push", localPath, devicePath]).wait();
			}
		}).future<void>()();
	}
}
