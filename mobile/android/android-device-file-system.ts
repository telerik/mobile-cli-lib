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

	public async getFile(deviceFilePath: string, appIdentifier: string, outputPath?: string): Promise<void> {
		const stdout = !outputPath;

		if (stdout) {
			temp.track();
			outputPath = temp.path({ prefix: "sync", suffix: ".tmp" });
		}

		await this.adb.executeCommand(["pull", deviceFilePath, outputPath]);

		if (stdout) {
			await new Promise<void>((resolve, reject) => {
				const readStream = this.$fs.createReadStream(outputPath);
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

	public async putFile(localFilePath: string, deviceFilePath: string, appIdentifier: string): Promise<void> {
		return this.adb.executeCommand(["push", localFilePath, deviceFilePath]);
	}

	public async transferFiles(deviceAppData: Mobile.IDeviceAppData, localToDevicePaths: Mobile.ILocalToDevicePathData[]): Promise<void> {
		// TODO: Do not start all promises simultaneously as this leads to error EMFILE on Windows for too many opened files.
		// Use chunks (for example on 100).
		await Promise.all(
			_(localToDevicePaths)
				.filter(localToDevicePathData => this.$fs.getFsStats(localToDevicePathData.getLocalPath()).isFile())
				.map(async localToDevicePathData => {
					const devicePath = localToDevicePathData.getDevicePath();
					await this.adb.executeCommand(["push", localToDevicePathData.getLocalPath(), devicePath]);
					await this.adb.executeShellCommand(["chmod", "0777", path.dirname(devicePath)]);
				}
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
		const deviceHashService = this.getDeviceHashService(deviceAppData.appIdentifier);
		if (! await deviceHashService.updateHashes(localToDevicePaths)) {
			this.$logger.trace("Unable to find hash file on device. The next livesync command will create it.");
		}
	}

	public async transferDirectory(deviceAppData: Mobile.IDeviceAppData, localToDevicePaths: Mobile.ILocalToDevicePathData[], projectFilesPath: string): Promise<Mobile.ILocalToDevicePathData[]> {
		const devicePaths: string[] = [];
		const currentShasums: IStringDictionary = {};

		await Promise.all(
			localToDevicePaths.map(async localToDevicePathData => {
				const localPath = localToDevicePathData.getLocalPath();
				const stats = this.$fs.getFsStats(localPath);
				if (stats.isFile()) {
					const fileShasum = await this.$fs.getFileShasum(localPath);
					currentShasums[localPath] = fileShasum;
				}

				devicePaths.push(`"${localToDevicePathData.getDevicePath()}"`);
			})
		);

		const commandsDeviceFilePath = this.$mobileHelper.buildDevicePath(await deviceAppData.getDeviceProjectRootPath(), "nativescript.commands.sh");

		const deviceHashService = this.getDeviceHashService(deviceAppData.appIdentifier);
		let filesToChmodOnDevice: string[] = devicePaths;
		let tranferredFiles: Mobile.ILocalToDevicePathData[] = [];
		const oldShasums = await deviceHashService.getShasumsFromDevice();
		if (this.$options.force || !oldShasums) {
			await this.adb.executeShellCommand(["rm", "-rf", deviceHashService.hashFileDevicePath]);
			await this.adb.executeCommand(["push", projectFilesPath, await deviceAppData.getDeviceProjectRootPath()]);
			tranferredFiles = localToDevicePaths;
		} else {
			// Create or update file hashes on device
			const changedShasums: any = _.omitBy(currentShasums, (hash: string, pathToFile: string) => !!_.find(oldShasums, (oldHash: string, oldPath: string) => pathToFile === oldPath && hash === oldHash));
			this.$logger.trace("Changed file hashes are:", changedShasums);
			filesToChmodOnDevice = [];
			await Promise.all(
				_(changedShasums)
					.map((hash: string, filePath: string) => _.find(localToDevicePaths, ldp => ldp.getLocalPath() === filePath))
					.map(localToDevicePathData => {
						tranferredFiles.push(localToDevicePathData);
						filesToChmodOnDevice.push(`"${localToDevicePathData.getDevicePath()}"`);
						return this.transferFile(localToDevicePathData.getLocalPath(), localToDevicePathData.getDevicePath());
					})
					.value()
			);
		}

		if (filesToChmodOnDevice.length) {
			await this.createFileOnDevice(commandsDeviceFilePath, "chmod 0777 " + filesToChmodOnDevice.join(" "));
			await this.adb.executeShellCommand([commandsDeviceFilePath]);
		}

		await deviceHashService.uploadHashFileToDevice(currentShasums);

		return tranferredFiles;
	}

	public async transferFile(localPath: string, devicePath: string): Promise<void> {
		this.$logger.trace(`Transfering ${localPath} to ${devicePath}`);
		const stats = this.$fs.getFsStats(localPath);
		if (stats.isDirectory()) {
			await this.adb.executeShellCommand(["mkdir", path.dirname(devicePath)]);
		} else {
			await this.adb.executeCommand(["push", localPath, devicePath]);
		}
	}

	public async createFileOnDevice(deviceFilePath: string, fileContent: string): Promise<void> {
		const hostTmpDir = this.getTempDir();
		const commandsFileHostPath = path.join(hostTmpDir, "temp.commands.file");
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
			this._deviceHashServices[appIdentifier] = this.$injector.resolve(AndroidDeviceHashService, { adb: this.adb, appIdentifier });
		}

		return this._deviceHashServices[appIdentifier];
	}
}
