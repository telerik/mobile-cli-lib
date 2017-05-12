import * as path from "path";
import * as temp from "temp";

export class AndroidDeviceHashService implements Mobile.IAndroidDeviceHashService {
	private static HASH_FILE_NAME = "hashes";
	private static DEVICE_ROOT_PATH = "/data/local/tmp";

	private _hashFileDevicePath: string = null;
	private _hashFileLocalPath: string = null;
	private _tempDir: string = null;

	constructor(private adb: Mobile.IDeviceAndroidDebugBridge,
		private appIdentifier: string,
		private $fs: IFileSystem,
		private $mobileHelper: Mobile.IMobileHelper) { }

	public get hashFileDevicePath(): string {
		if (!this._hashFileDevicePath) {
			this._hashFileDevicePath = this.$mobileHelper.buildDevicePath(AndroidDeviceHashService.DEVICE_ROOT_PATH, this.appIdentifier, AndroidDeviceHashService.HASH_FILE_NAME);
		}

		return this._hashFileDevicePath;
	}

	public async doesShasumFileExistsOnDevice(): Promise<boolean> {
		let lsResult = await this.adb.executeShellCommand(["ls", this.hashFileDevicePath]);
		return !!(lsResult && lsResult.trim() === this.hashFileDevicePath);
	}

	public async getShasumsFromDevice(): Promise<IStringDictionary> {
		let hashFileLocalPath = await this.downloadHashFileFromDevice();

		if (this.$fs.exists(hashFileLocalPath)) {
			return this.$fs.readJson(hashFileLocalPath);
		}

		return null;
	}

	public async uploadHashFileToDevice(data: IStringDictionary | Mobile.ILocalToDevicePathData[]): Promise<void> {
		let shasums: IStringDictionary = {};
		if (_.isArray(data)) {
			await Promise.all(
				(<Mobile.ILocalToDevicePathData[]>data).map(async localToDevicePathData => {
					let localPath = localToDevicePathData.getLocalPath();
					return this.$fs.executeActionIfExists(async () => {
						let stats = this.$fs.getFsStats(localPath);
						if (stats.isFile()) {
							let fileShasum = await this.$fs.getFileShasum(localPath);
							shasums[localPath] = fileShasum;
						}
					});
				})
			);
		} else {
			shasums = <IStringDictionary>data;
		}

		this.$fs.writeJson(this.hashFileLocalPath, shasums);
		await this.adb.executeCommand(["push", this.hashFileLocalPath, this.hashFileDevicePath]);
	}

	public async updateHashes(localToDevicePaths: Mobile.ILocalToDevicePathData[]): Promise<boolean> {
		let oldShasums = await this.getShasumsFromDevice();
		if (oldShasums) {
			await Promise.all(
				_.map(localToDevicePaths, async ldp => {
					let localPath = ldp.getLocalPath();
					return this.$fs.executeActionIfExists(async () => {
						if (this.$fs.getFsStats(localPath).isFile()) {
							oldShasums[localPath] = await this.$fs.getFileShasum(localPath);
						}
					});
				})
			);

			await this.uploadHashFileToDevice(oldShasums);

			return true;
		}

		return false;
	}

	public async removeHashes(localToDevicePaths: Mobile.ILocalToDevicePathData[]): Promise<boolean> {
		let oldShasums = await this.getShasumsFromDevice();
		if (oldShasums) {
			let fileToShasumDictionary = <IStringDictionary>(_.omit(oldShasums, localToDevicePaths.map(ldp => ldp.getLocalPath())));
			await this.uploadHashFileToDevice(fileToShasumDictionary);
			return true;
		}

		return false;
	}

	private get hashFileLocalPath(): string {
		if (!this._hashFileLocalPath) {
			this._hashFileLocalPath = path.join(this.tempDir, AndroidDeviceHashService.HASH_FILE_NAME);
		}

		return this._hashFileLocalPath;
	}

	private get tempDir(): string {
		if (!this._tempDir) {
			temp.track();
			this._tempDir = temp.mkdirSync(`android-device-hash-service-${this.appIdentifier}`);
		}

		return this._tempDir;
	}

	private async downloadHashFileFromDevice(): Promise<string> {
		if (!this.$fs.exists(this.hashFileLocalPath)) {
			await this.adb.executeCommand(["pull", this.hashFileDevicePath, this.tempDir]);
		}
		return this.hashFileLocalPath;
	}
}
