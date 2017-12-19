import * as path from "path";
import * as temp from "temp";
import { cache } from "../../decorators";
import { executeActionByChunks } from "../../helpers";
import { DEFAULT_CHUNK_SIZE } from "../../constants";

export class AndroidDeviceHashService implements Mobile.IAndroidDeviceHashService {
	private static HASH_FILE_NAME = "hashes";
	private static DEVICE_ROOT_PATH = "/data/local/tmp";

	constructor(private adb: Mobile.IDeviceAndroidDebugBridge,
		private appIdentifier: string,
		private $fs: IFileSystem,
		private $mobileHelper: Mobile.IMobileHelper) {
	}

	@cache()
	public get hashFileDevicePath(): string {
		return this.$mobileHelper.buildDevicePath(AndroidDeviceHashService.DEVICE_ROOT_PATH, this.appIdentifier, AndroidDeviceHashService.HASH_FILE_NAME);
	}

	public async doesShasumFileExistsOnDevice(): Promise<boolean> {
		const lsResult = await this.adb.executeShellCommand(["ls", this.hashFileDevicePath]);
		return !!(lsResult && lsResult.trim() === this.hashFileDevicePath);
	}

	public async getShasumsFromDevice(): Promise<IStringDictionary> {
		const hashFileLocalPath = await this.downloadHashFileFromDevice();

		if (this.$fs.exists(hashFileLocalPath)) {
			return this.$fs.readJson(hashFileLocalPath);
		}

		return null;
	}

	public async uploadHashFileToDevice(data: IStringDictionary): Promise<void> {
		this.$fs.writeJson(this.hashFileLocalPath, data);
		await this.adb.executeCommand(["push", this.hashFileLocalPath, this.hashFileDevicePath]);
	}

	public async updateHashes(localToDevicePaths: Mobile.ILocalToDevicePathData[]): Promise<boolean> {
		const oldShasums = await this.getShasumsFromDevice();
		if (oldShasums) {
			await this.generateHashesFromLocalToDevicePaths(localToDevicePaths, oldShasums);

			await this.uploadHashFileToDevice(oldShasums);

			return true;
		}

		return false;
	}

	public async generateHashesFromLocalToDevicePaths(localToDevicePaths: Mobile.ILocalToDevicePathData[], shasums: IStringDictionary): Promise<string[]> {
		const devicePaths: string[] = [];
		const action = async (localToDevicePathData: Mobile.ILocalToDevicePathData) => {
			const localPath = localToDevicePathData.getLocalPath();
			if (this.$fs.getFsStats(localPath).isFile()) {
				// TODO: Use relative to project path for key
				// This will speed up livesync on the same device for the same project on different PCs.
				shasums[localPath] = await this.$fs.getFileShasum(localPath);
			}

			devicePaths.push(`"${localToDevicePathData.getDevicePath()}"`);
		};

		await executeActionByChunks<Mobile.ILocalToDevicePathData>(localToDevicePaths, DEFAULT_CHUNK_SIZE, action);

		return devicePaths;
	}

	public async removeHashes(localToDevicePaths: Mobile.ILocalToDevicePathData[]): Promise<boolean> {
		const oldShasums = await this.getShasumsFromDevice();
		if (oldShasums) {
			const fileToShasumDictionary = <IStringDictionary>(_.omit(oldShasums, localToDevicePaths.map(ldp => ldp.getLocalPath())));
			await this.uploadHashFileToDevice(fileToShasumDictionary);
			return true;
		}

		return false;
	}

	@cache()
	private get hashFileLocalPath(): string {
		return path.join(this.tempDir, AndroidDeviceHashService.HASH_FILE_NAME);
	}

	@cache()
	private get tempDir(): string {
		temp.track();
		return temp.mkdirSync(`android-device-hash-service-${this.appIdentifier}`);
	}

	private async downloadHashFileFromDevice(): Promise<string> {
		if (!this.$fs.exists(this.hashFileLocalPath)) {
			await this.adb.executeCommand(["pull", this.hashFileDevicePath, this.tempDir]);
		}
		return this.hashFileLocalPath;
	}
}
