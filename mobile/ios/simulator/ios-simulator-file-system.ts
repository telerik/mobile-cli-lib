///<reference path="../../../.d.ts"/>
"use strict";

import Future = require("fibers/future");
import * as shell from "shelljs";

export class IOSSimulatorFileSystem implements Mobile.IDeviceFileSystem {
	constructor(private iosSim: any,
		private identifier: string,
		private $logger: ILogger) { }

	public listFiles(devicePath: string): IFuture<void> {
		return this.iosSim.listFiles(devicePath);
	}

	public getFile(deviceFilePath: string): IFuture<void> {
		return this.iosSim.getFile(deviceFilePath);
	}

	public putFile(localFilePath: string, deviceFilePath: string): IFuture<void> {
		return this.iosSim.putFile(localFilePath, deviceFilePath);
	}

	public deleteFile(deviceFilePath: string, appIdentifier: string): void {
		shell.rm("-rf", deviceFilePath);
	}

	public transferFiles(appIdentifier: string, localToDevicePaths: Mobile.ILocalToDevicePathData[]): IFuture<void> {
		return (() => {
			_.each(localToDevicePaths, localToDevicePathData => this.transferFile(localToDevicePathData.getLocalPath(), localToDevicePathData.getDevicePath()).wait());
		}).future<void>()();
	}

	public transferDirectory(deviceAppData: Mobile.IDeviceAppData, localToDevicePaths: Mobile.ILocalToDevicePathData[], projectFilesPath: string): IFuture<void> {
		let destinationPath = this.iosSim.getApplicationPath(this.identifier, deviceAppData.appIdentifier);
		this.$logger.trace(`Transferring from ${projectFilesPath} to ${destinationPath}`);
		return Future.fromResult(shell.cp("-Rf", projectFilesPath,  destinationPath));
	}

	public transferFile(localFilePath: string, deviceFilePath: string): IFuture<void> {
		this.$logger.trace(`Transferring from ${localFilePath} to ${deviceFilePath}`);
		return Future.fromResult(shell.cp("-f", localFilePath,  deviceFilePath));
	}
}
