import Future = require("fibers/future");
import * as path from "path";
import * as shelljs from "shelljs";

export class IOSSimulatorFileSystem implements Mobile.IDeviceFileSystem {
	constructor(private iosSim: any,
		private identifier: string,
		private $fs: IFileSystem,
		private $logger: ILogger) { }

	public listFiles(devicePath: string): IFuture<void> {
		return this.iosSim.listFiles(devicePath);
	}

	public getFile(deviceFilePath: string, outputFilePath?: string): IFuture<void> {
		return (() => {
			if (outputFilePath) {
				shelljs.cp("-f", deviceFilePath, outputFilePath);
			}
		}).future<void>()();
	}

	public putFile(localFilePath: string, deviceFilePath: string): IFuture<void> {
		return (() => {
			shelljs.cp("-f", localFilePath, deviceFilePath);
		}).future<void>()();
	}

	public deleteFile(deviceFilePath: string, appIdentifier: string): void {
		shelljs.rm("-rf", deviceFilePath);
	}

	public async transferFiles(deviceAppData: Mobile.IDeviceAppData, localToDevicePaths: Mobile.ILocalToDevicePathData[]): Promise<void> {
			_.each(localToDevicePaths, localToDevicePathData => await  this.transferFile(localToDevicePathData.getLocalPath(), localToDevicePathData.getDevicePath()));
	}

	public transferDirectory(deviceAppData: Mobile.IDeviceAppData, localToDevicePaths: Mobile.ILocalToDevicePathData[], projectFilesPath: string): IFuture<void> {
		let destinationPath = deviceAppData.deviceProjectRootPath;
		this.$logger.trace(`Transferring from ${projectFilesPath} to ${destinationPath}`);
		return Future.fromResult(shelljs.cp("-Rf", path.join(projectFilesPath, "*"), destinationPath));
	}

	public async transferFile(localFilePath: string, deviceFilePath: string): Promise<void> {
			this.$logger.trace(`Transferring from ${localFilePath} to ${deviceFilePath}`);
			if (this.$fs.getFsStats(localFilePath).isDirectory()) {
				shelljs.mkdir(deviceFilePath);
			} else {
				shelljs.cp("-f", localFilePath, deviceFilePath);
			}
	}
}
