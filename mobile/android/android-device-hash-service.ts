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

	public doesShasumFileExistsOnDevice(): IFuture<boolean> {
		return ((): boolean => {
			let lsResult = this.adb.executeShellCommand(["ls", this.hashFileDevicePath]).wait();
			return !!(lsResult && lsResult.trim() === this.hashFileDevicePath);
		}).future<boolean>()();
	}

	public getShasumsFromDevice(): IFuture<IStringDictionary> {
		return (() => {
			let hashFileLocalPath = this.downloadHashFileFromDevice().wait();

			if (this.$fs.exists(hashFileLocalPath)) {
				return this.$fs.readJson(hashFileLocalPath).wait();
			}

			return null;
		}).future<IStringDictionary>()();
	}

	public uploadHashFileToDevice(data: IStringDictionary|Mobile.ILocalToDevicePathData[]): IFuture<void> {
		return (() => {
			let shasums: IStringDictionary = {};
			if (_.isArray(data)) {
				(<Mobile.ILocalToDevicePathData[]>data).forEach(localToDevicePathData => {
					let localPath = localToDevicePathData.getLocalPath();
					let stats = this.$fs.getFsStats(localPath).wait();
					if (stats.isFile()) {
						let fileShasum = this.$fs.getFileShasum(localPath).wait();
						shasums[localPath] = fileShasum;
					}
				});
			} else {
				shasums = <IStringDictionary>data;
			}

			this.$fs.writeJson(this.hashFileLocalPath, shasums).wait();
			this.adb.executeCommand(["push", this.hashFileLocalPath, this.hashFileDevicePath]).wait();
		}).future<void>()();
	}

	public updateHashes(localToDevicePaths: Mobile.ILocalToDevicePathData[]): IFuture<boolean> {
		return (() => {
			let oldShasums = this.getShasumsFromDevice().wait();
			if (oldShasums) {
				_.each(localToDevicePaths, ldp => {
					let localPath = ldp.getLocalPath();
					if (this.$fs.getFsStats(localPath).wait().isFile()) {
						oldShasums[localPath] = this.$fs.getFileShasum(localPath).wait();
					}
				});
				this.uploadHashFileToDevice(oldShasums).wait();
				return true;
			}

			return false;
		}).future<boolean>()();
	}

	public removeHashes(localToDevicePaths: Mobile.ILocalToDevicePathData[]): IFuture<boolean> {
		return (() => {
			let oldShasums = this.getShasumsFromDevice().wait();
			if (oldShasums) {
				let fileToShasumDictionary = <IStringDictionary>(_.omit(oldShasums, localToDevicePaths.map(ldp => ldp.getLocalPath())));
				this.uploadHashFileToDevice(fileToShasumDictionary).wait();
				return true;
			}

			return false;
		}).future<boolean>()();
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

	private downloadHashFileFromDevice(): IFuture<string> {
		return (() => {
			if (!this.$fs.exists(this.hashFileLocalPath)) {
				this.adb.executeCommand(["pull", this.hashFileDevicePath, this.tempDir]).wait();
			}
			return this.hashFileLocalPath;
		}).future<string>()();
	}
}
