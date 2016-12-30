import * as path from "path";
import * as shelljs from "shelljs";

export class IOSSimulatorFileSystem implements Mobile.IDeviceFileSystem {
	constructor(private iosSim: any,
		private identifier: string,
		private $fs: IFileSystem,
		private $logger: ILogger) { }

	public async listFiles(devicePath: string): Promise<void> {
		return this.iosSim.listFiles(devicePath);
	}

	public async getFile(deviceFilePath: string, outputFilePath?: string): Promise<void> {
		if (outputFilePath) {
			shelljs.cp("-f", deviceFilePath, outputFilePath);
		}
	}

	public async putFile(localFilePath: string, deviceFilePath: string): Promise<void> {
		shelljs.cp("-f", localFilePath, deviceFilePath);
	}

	public deleteFile(deviceFilePath: string, appIdentifier: string): void {
		shelljs.rm("-rf", deviceFilePath);
	}

	public transferFiles(deviceAppData: Mobile.IDeviceAppData, localToDevicePaths: Mobile.ILocalToDevicePathData[]): void {
		_.each(localToDevicePaths,async localToDevicePathData => await this.transferFile(localToDevicePathData.getLocalPath(), localToDevicePathData.getDevicePath()));
	}

	public async transferDirectory(deviceAppData: Mobile.IDeviceAppData, localToDevicePaths: Mobile.ILocalToDevicePathData[], projectFilesPath: string): Promise<void> {
		let destinationPath = deviceAppData.deviceProjectRootPath;
		this.$logger.trace(`Transferring from ${projectFilesPath} to ${destinationPath}`);
		return Promise.resolve(shelljs.cp("-Rf", path.join(projectFilesPath, "*"), destinationPath));
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
