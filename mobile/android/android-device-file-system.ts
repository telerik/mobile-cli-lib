import * as path from "path";
import * as temp from "temp";
import { AndroidDeviceHashService } from "./android-device-hash-service";

export class AndroidDeviceFileSystem implements Mobile.IDeviceFileSystem {
	private _deviceHashServices = Object.create(null);

	constructor(private adb: Mobile.IDeviceAndroidDebugBridge,
		private $fs: IFileSystem,
		private $logger: ILogger,
		private $mobileHelper: Mobile.IMobileHelper,
		private $injector: IInjector,
		private $options: ICommonOptions) { }

	public async listFiles(devicePath: string, appIdentifier?: string): Promise<any> {
		let listCommandArgs = ["ls", "-a", devicePath];
		if (appIdentifier) {
			listCommandArgs = ["run-as", appIdentifier].concat(listCommandArgs);
		}

		return this.adb.executeShellCommand(listCommandArgs);
	}

	public async getFile(deviceFilePath: string, outputPath?: string): Promise<void> {
		let stdout = !outputPath;

		if (stdout) {
			temp.track();
			outputPath = temp.path({ prefix: "sync", suffix: ".tmp" });
		}

		await this.adb.executeCommand(["pull", deviceFilePath, outputPath]);

		if (stdout) {
			await new Promise<void>((resolve, reject) => {
				let readStream = this.$fs.createReadStream(outputPath);
				readStream.pipe(process.stdout);
				readStream.on("end", () => {
					resolve();
				});
				readStream.on("error", (err: Error) => {
					reject(err);
				});
			});
		}
	}

	public async putFile(localFilePath: string, deviceFilePath: string): Promise<void> {
		return this.adb.executeCommand(["push", localFilePath, deviceFilePath]);
	}

	public async transferFiles(deviceAppData: Mobile.IDeviceAppData, localToDevicePaths: Mobile.ILocalToDevicePathData[]): Promise<void> {
		await Promise.all(
			_(localToDevicePaths)
				.filter(localToDevicePathData => this.$fs.getFsStats(localToDevicePathData.getLocalPath()).isFile())
				.map(async localToDevicePathData =>
					await this.adb.executeCommand(["push", localToDevicePathData.getLocalPath(), localToDevicePathData.getDevicePath()])
				)
				.value()
		);

		await Promise.all(
			_(localToDevicePaths)
				.filter(localToDevicePathData => this.$fs.getFsStats(localToDevicePathData.getLocalPath()).isDirectory())
				.map(async localToDevicePathData =>
					await this.adb.executeShellCommand(["chmod", "0777", localToDevicePathData.getDevicePath()])
				)
				.value()
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

		await Promise.all(
			localToDevicePaths.map(async localToDevicePathData => {
				let localPath = localToDevicePathData.getLocalPath();
				let stats = this.$fs.getFsStats(localPath);
				if (stats.isFile()) {
					let fileShasum = await this.$fs.getFileShasum(localPath);
					currentShasums[localPath] = fileShasum;
				}

				devicePaths.push(`"${localToDevicePathData.getDevicePath()}"`);
			})
		);

		let commandsDeviceFilePath = this.$mobileHelper.buildDevicePath(await deviceAppData.getDeviceProjectRootPath(), "nativescript.commands.sh");

		let deviceHashService = this.getDeviceHashService(deviceAppData.appIdentifier);
		let filesToChmodOnDevice: string[] = devicePaths;
		if (this.$options.force) {
			await this.adb.executeShellCommand(["rm", "-rf", deviceHashService.hashFileDevicePath]);
			await this.adb.executeCommand(["push", projectFilesPath, await deviceAppData.getDeviceProjectRootPath()]);
		} else {
			// Create or update file hashes on device
			let oldShasums = await deviceHashService.getShasumsFromDevice();
			if (oldShasums) {
				let changedShasums: any = _.omitBy(currentShasums, (hash: string, pathToFile: string) => !!_.find(oldShasums, (oldHash: string, oldPath: string) => pathToFile === oldPath && hash === oldHash));
				this.$logger.trace("Changed file hashes are:", changedShasums);
				filesToChmodOnDevice = [];
				await Promise.all(
					_(changedShasums)
					.map((hash: string, filePath: string) => _.find(localToDevicePaths, ldp => ldp.getLocalPath() === filePath))
					.map(localToDevicePathData => {
						filesToChmodOnDevice.push(`"${localToDevicePathData.getDevicePath()}"`);
						return this.transferFile(localToDevicePathData.getLocalPath(), localToDevicePathData.getDevicePath());
					})
					.value()
				);
			} else {
				await this.adb.executeCommand(["push", projectFilesPath, await deviceAppData.getDeviceProjectRootPath()]);
			}
		}

		if (filesToChmodOnDevice.length) {
			await this.createFileOnDevice(commandsDeviceFilePath, "chmod 0777 " + filesToChmodOnDevice.join(" "));
			await this.adb.executeShellCommand([commandsDeviceFilePath]);
		}

		await deviceHashService.uploadHashFileToDevice(currentShasums);
	}

	public async transferFile(localPath: string, devicePath: string): Promise<void> {
		this.$logger.trace(`Transfering ${localPath} to ${devicePath}`);
		let stats = this.$fs.getFsStats(localPath);
		if (stats.isDirectory()) {
			await this.adb.executeShellCommand(["mkdir", path.dirname(devicePath)]);
		} else {
			await this.adb.executeCommand(["push", localPath, devicePath]);
		}
	}

	public async createFileOnDevice(deviceFilePath: string, fileContent: string): Promise<void> {
		let hostTmpDir = this.getTempDir();
		let commandsFileHostPath = path.join(hostTmpDir, "temp.commands.file");
		this.$fs.writeFile(commandsFileHostPath, fileContent);

		// copy it to the device
		await this.transferFile(commandsFileHostPath, deviceFilePath);
		await this.adb.executeShellCommand(["chmod", "0777", deviceFilePath]);
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
