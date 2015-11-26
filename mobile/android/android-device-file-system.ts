///<reference path="../../.d.ts"/>
"use strict";

import * as path from "path";
import * as temp from "temp";
import future = require("fibers/future");

export class AndroidDeviceFileSystem implements Mobile.IDeviceFileSystem {
	constructor(private adb: Mobile.IAndroidDebugBridge,
		private identifier: string,
		private $fs: IFileSystem,
		private $logger: ILogger,
		private $deviceAppDataFactory: Mobile.IDeviceAppDataFactory,
		private $mobileHelper: Mobile.IMobileHelper) { }

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

			let command = _.map(localToDevicePaths, (localToDevicePathData) => `"${localToDevicePathData.getDevicePath()}"`).join(" ");
			let commandsDeviceFilePath = this.$mobileHelper.buildDevicePath(deviceAppData.deviceProjectRootPath, "nativescript.commands.sh");
			this.createFileOnDevice(commandsDeviceFilePath, command).wait();
			this.adb.executeShellCommand([commandsDeviceFilePath]).wait();
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

	public createFileOnDevice(deviceFilePath: string, fileContent: string): IFuture<void> {
		return (() => {
			let hostTmpDir = this.getTempDir();
			let commandsFileHostPath = path.join(hostTmpDir, "temp.commands.file");
			this.$fs.writeFile(commandsFileHostPath, fileContent).wait();

			// copy it to the device
			this.transferFile(commandsFileHostPath, deviceFilePath).wait();
			this.adb.executeShellCommand(["chmod", "0777", deviceFilePath]).wait();
		}).future<void>()();
	}

	private getTempDir(): string {
		temp.track();
		return temp.mkdirSync("application-");
	}

}
