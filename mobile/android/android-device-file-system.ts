import * as path from "path";
import * as temp from "temp";
import {AndroidDeviceHashService} from "./android-device-hash-service";
import Future = require("fibers/future");

export class AndroidDeviceFileSystem implements Mobile.IDeviceFileSystem {
	private _deviceHashServices = Object.create(null);

	constructor(private adb: Mobile.IDeviceAndroidDebugBridge,
		private identifier: string,
		private $fs: IFileSystem,
		private $logger: ILogger,
		private $mobileHelper: Mobile.IMobileHelper,
		private $injector: IInjector,
		private $options: ICommonOptions) { }

	public listFiles(devicePath: string, appIdentifier?: string): IFuture<any> {
		let listCommandArgs = ["ls", "-a", devicePath];
		if (appIdentifier) {
			listCommandArgs = ["run-as", appIdentifier].concat(listCommandArgs);
		}

		return this.adb.executeShellCommand(listCommandArgs);
	}

	public getFile(deviceFilePath: string, outputPath?: string): IFuture<void> {
		return (() => {
			let stdout = !outputPath;
			if (stdout) {
				temp.track();
				outputPath = temp.path({prefix: "sync", suffix: ".tmp"});
			}
			this.adb.executeCommand(["pull", deviceFilePath, outputPath]).wait();
			if (stdout) {
				let readStream = this.$fs.createReadStream(outputPath);
				let future = new Future<void>();
				readStream.pipe(process.stdout);
				readStream.on("end", () => {
					future.return();
				});
				readStream.on("error", (err: Error) => {
					future.throw(err);
				});
				future.wait();
			}
		}).future<void>()();
 	}

	public putFile(localFilePath: string, deviceFilePath: string): IFuture<void> {
		return this.adb.executeCommand(["push", localFilePath, deviceFilePath]);
	}

	public async transferFiles(deviceAppData: Mobile.IDeviceAppData, localToDevicePaths: Mobile.ILocalToDevicePathData[]): Promise<void> {
			_(localToDevicePaths)
				.filter(localToDevicePathData => this.$fs.getFsStats(localToDevicePathData.getLocalPath()).isFile())
				.each(localToDevicePathData =>
					this.adb.executeCommand(["push", localToDevicePathData.getLocalPath(), localToDevicePathData.getDevicePath()]).wait()
				);

			_(localToDevicePaths)
				.filter(localToDevicePathData => this.$fs.getFsStats(localToDevicePathData.getLocalPath()).isDirectory())
				.each(localToDevicePathData =>
					this.adb.executeShellCommand(["chmod", "0777", localToDevicePathData.getDevicePath()]).wait()
				);

			// Update hashes
			let deviceHashService = this.getDeviceHashService(deviceAppData.appIdentifier);
			if (! await deviceHashService.updateHashes(localToDevicePaths)) {
				this.$logger.trace("Unable to find hash file on device. The next livesync command will create it.");
			}
	}

	public async transferDirectory(deviceAppData: Mobile.IDeviceAppData, localToDevicePaths: Mobile.ILocalToDevicePathData[], projectFilesPath: string): Promise<void> {
			let devicePaths: string[] = [],
				currentShasums: IStringDictionary = {};

			localToDevicePaths.forEach(localToDevicePathData => {
				let localPath = localToDevicePathData.getLocalPath();
				let stats = this.$fs.getFsStats(localPath);
				if (stats.isFile()) {
					let fileShasum = await  this.$fs.getFileShasum(localPath);
					currentShasums[localPath] = fileShasum;
				}
				devicePaths.push(`"${localToDevicePathData.getDevicePath()}"`);
			});

			let commandsDeviceFilePath = this.$mobileHelper.buildDevicePath(deviceAppData.deviceProjectRootPath, "nativescript.commands.sh");

			let deviceHashService = this.getDeviceHashService(deviceAppData.appIdentifier);
			let filesToChmodOnDevice: string[] = devicePaths;
			if (this.$options.force) {
				this.adb.executeShellCommand(["rm", "-rf", deviceHashService.hashFileDevicePath]).wait();
				this.adb.executeCommand(["push", projectFilesPath, deviceAppData.deviceProjectRootPath]).wait();
			} else {
				// Create or update file hashes on device
				let oldShasums = await  deviceHashService.getShasumsFromDevice();
				if (oldShasums) {
					let changedShasums: any = _.omitBy(currentShasums, (hash: string, pathToFile: string) => !!_.find(oldShasums, (oldHash: string, oldPath: string) => pathToFile === oldPath && hash === oldHash));
					this.$logger.trace("Changed file hashes are:", changedShasums);
					filesToChmodOnDevice = [];
					let futures = _(changedShasums)
						.map((hash: string, filePath: string) => _.find(localToDevicePaths, ldp => ldp.getLocalPath() === filePath))
						.map(localToDevicePathData => {
							filesToChmodOnDevice.push(`"${localToDevicePathData.getDevicePath()}"`);
							return this.transferFile(localToDevicePathData.getLocalPath(), localToDevicePathData.getDevicePath());
						})
						.value();
					Future.wait(futures);
				} else {
					this.adb.executeCommand(["push", projectFilesPath, deviceAppData.deviceProjectRootPath]).wait();
				}
			}

			if (filesToChmodOnDevice.length) {
				this.createFileOnDevice(commandsDeviceFilePath, "chmod 0777 " + await  filesToChmodOnDevice.join(" "));
				this.adb.executeShellCommand([commandsDeviceFilePath]).wait();
			}
			deviceHashService.uploadHashFileToDevice(currentShasums).wait();
	}

	public async transferFile(localPath: string, devicePath: string): Promise<void> {
			this.$logger.trace(`Transfering ${localPath} to ${devicePath}`);
			let stats = this.$fs.getFsStats(localPath);
			if (stats.isDirectory()) {
				this.adb.executeShellCommand(["mkdir", path.dirname(devicePath)]).wait();
			} else {
				this.adb.executeCommand(["push", localPath, devicePath]).wait();
			}
	}

	public async createFileOnDevice(deviceFilePath: string, fileContent: string): Promise<void> {
			let hostTmpDir = this.getTempDir();
			let commandsFileHostPath = path.join(hostTmpDir, "temp.commands.file");
			this.$fs.writeFile(commandsFileHostPath, fileContent);

			// copy it to the device
			this.transferFile(commandsFileHostPath, deviceFilePath).wait();
			this.adb.executeShellCommand(["chmod", "0777", deviceFilePath]).wait();
	}

	private getTempDir(): string {
		temp.track();
		return temp.mkdirSync("application-");
	}

	private getDeviceHashService(appIdentifier: string): Mobile.IAndroidDeviceHashService {
		if (!this._deviceHashServices[appIdentifier]) {
			this._deviceHashServices[appIdentifier] = this.$injector.resolve(AndroidDeviceHashService, { adb: this.adb, appIdentifier: appIdentifier });
		}

		return this._deviceHashServices[appIdentifier];
	}
}
