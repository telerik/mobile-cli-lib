import * as path from "path";
import * as temp from "temp";
import { AndroidDeviceHashService } from "./android-device-hash-service";
import { executeActionByChunks } from "../../helpers";
import { DEFAULT_CHUNK_SIZE } from '../../constants';

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
		await this.adb.pushFile(localFilePath, deviceFilePath);
	}

	public async transferFiles(deviceAppData: Mobile.IDeviceAppData, localToDevicePaths: Mobile.ILocalToDevicePathData[]): Promise<Mobile.ILocalToDevicePathData[]> {
		const directoriesToChmod: string[] = [];
		const transferredFiles: Mobile.ILocalToDevicePathData[] = [];
		const action = async (localToDevicePathData: Mobile.ILocalToDevicePathData) => {
			const fstat = this.$fs.getFsStats(localToDevicePathData.getLocalPath());
			if (fstat.isFile()) {
				const devicePath = localToDevicePathData.getDevicePath();
				await this.adb.pushFile(localToDevicePathData.getLocalPath(), devicePath);
				transferredFiles.push(localToDevicePathData);
			} else if (fstat.isDirectory()) {
				const dirToChmod = localToDevicePathData.getDevicePath();
				directoriesToChmod.push(dirToChmod);
			}
		};

		await executeActionByChunks<Mobile.ILocalToDevicePathData>(localToDevicePaths, DEFAULT_CHUNK_SIZE, action);

		const dirsChmodAction = (directoryToChmod: string) => this.adb.executeShellCommand(["chmod", "0777", directoryToChmod]);

		await executeActionByChunks<string>(_.uniq(directoriesToChmod), DEFAULT_CHUNK_SIZE, dirsChmodAction);

		// Update hashes
		const deviceHashService = this.getDeviceHashService(deviceAppData.appIdentifier);
		if (! await deviceHashService.updateHashes(localToDevicePaths)) {
			this.$logger.trace("Unable to find hash file on device. The next livesync command will create it.");
		}

		return transferredFiles;
	}

	public async transferDirectory(deviceAppData: Mobile.IDeviceAppData, localToDevicePaths: Mobile.ILocalToDevicePathData[], projectFilesPath: string): Promise<Mobile.ILocalToDevicePathData[]> {
		const deviceHashService = this.getDeviceHashService(deviceAppData.appIdentifier);
		const currentShasums: IStringDictionary = await deviceHashService.generateHashesFromLocalToDevicePaths(localToDevicePaths);
		const devicePaths: string[] = await deviceHashService.getDevicePaths(localToDevicePaths);

		const commandsDeviceFilePath = this.$mobileHelper.buildDevicePath(await deviceAppData.getDeviceProjectRootPath(), "nativescript.commands.sh");

		let filesToChmodOnDevice: string[] = devicePaths;
		let transferredFiles: Mobile.ILocalToDevicePathData[] = [];
		const oldShasums = await deviceHashService.getShasumsFromDevice();
		if (this.$options.force || !oldShasums) {
			await this.adb.executeShellCommand(["rm", "-rf", deviceHashService.hashFileDevicePath]);
			await this.adb.pushFile(projectFilesPath, await deviceAppData.getDeviceProjectRootPath());
			transferredFiles = localToDevicePaths;
		} else {
			// Create or update file hashes on device
			const changedShasums = deviceHashService.getChnagedShasums(oldShasums, currentShasums);
			this.$logger.trace("Changed file hashes are:", changedShasums);
			filesToChmodOnDevice = [];

			const transferFileAction = async (hash: string, filePath: string) => {
				const localToDevicePathData = _.find(localToDevicePaths, ldp => ldp.getLocalPath() === filePath);
				transferredFiles.push(localToDevicePathData);
				filesToChmodOnDevice.push(`"${localToDevicePathData.getDevicePath()}"`);
				return this.transferFile(localToDevicePathData.getLocalPath(), localToDevicePathData.getDevicePath());
			};

			await executeActionByChunks<string>(changedShasums, DEFAULT_CHUNK_SIZE, transferFileAction);
		}

		if (filesToChmodOnDevice.length) {
			await this.createFileOnDevice(commandsDeviceFilePath, "chmod 0777 " + filesToChmodOnDevice.join(" "));
			await this.adb.executeShellCommand([commandsDeviceFilePath]);
		}

		await deviceHashService.uploadHashFileToDevice(currentShasums);

		return transferredFiles;
	}

	public async transferFile(localPath: string, devicePath: string): Promise<void> {
		this.$logger.trace(`Transfering ${localPath} to ${devicePath}`);
		const stats = this.$fs.getFsStats(localPath);
		if (stats.isDirectory()) {
			await this.adb.executeShellCommand(["mkdir", path.dirname(devicePath)]);
		} else {
			await this.adb.pushFile(localPath, devicePath);
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
