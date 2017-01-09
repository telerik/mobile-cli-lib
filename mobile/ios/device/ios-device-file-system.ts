import * as iOSProxyServices from "./ios-proxy-services";
import * as path from "path";
import * as ref from "ref";
import * as util from "util";

export class IOSDeviceFileSystem implements Mobile.IDeviceFileSystem {
	constructor(private device: Mobile.IiOSDevice,
		private devicePointer: NodeBuffer,
		private $coreFoundation: Mobile.ICoreFoundation,
		private $errors: IErrors,
		private $fs: IFileSystem,
		private $injector: IInjector,
		private $logger: ILogger,
		private $mobileDevice: Mobile.IMobileDevice,
		private $options: ICommonOptions) { }

	public async listFiles(devicePath: string, appIdentifier?: string): Promise<any> {
		if (!devicePath) {
			devicePath = ".";
		}

		this.$logger.info("Listing %s", devicePath);

		let afcClient = this.resolveAfc();

		let walk = (root: string, indent: number) => {
			this.$logger.info(util.format("%s %s", Array(indent).join(" "), root));
			let children: string[] = [];
			try {
				children = afcClient.listDir(root);
			} catch (e) {
				children = [];
			}

			_.each(children, (child: string) => {
				walk(root + "/" + child, indent + 1);
			});
		};

		walk(devicePath, 0);
	}

	public getFile(deviceFilePath: string, outputFilePath?: string): Promise<void> {
		return new Promise<void>((resolve, reject) => {
			try {
				let afcClient = this.resolveAfc();
				let fileToRead = afcClient.open(deviceFilePath, "r");
				let fileToWrite = outputFilePath ? this.$fs.createWriteStream(outputFilePath) : process.stdout;
				if (outputFilePath) {
					fileToWrite.on("close", () => {
						resolve();
					});
				}
				let dataSizeToRead = 8192;
				let size = 0;
				while (true) {
					let data = fileToRead.read(dataSizeToRead);
					if (!data || data.length === 0) {
						break;
					}
					fileToWrite.write(data);
					size += data.length;
				}
				fileToRead.close();
				if (outputFilePath) {
					fileToWrite.end();
				}
				this.$logger.trace("%s bytes read from %s", size.toString(), deviceFilePath);
			} catch (err) {
				this.$logger.trace("Error while getting file from device", err);
				reject(err);
			}
		});
	}

	public putFile(localFilePath: string, deviceFilePath: string): Promise<void> {
		let afcClient = this.resolveAfc();
		return afcClient.transfer(path.resolve(localFilePath), deviceFilePath);
	}

	public async deleteFile(deviceFilePath: string, appIdentifier: string): Promise<void> {
		let houseArrestClient: Mobile.IHouseArrestClient = this.$injector.resolve(iOSProxyServices.HouseArrestClient, { device: this.device });
		let afcClient = await this.getAfcClient(houseArrestClient, deviceFilePath, appIdentifier);
		afcClient.deleteFile(deviceFilePath);
		houseArrestClient.closeSocket();
	}

	public async transferFiles(deviceAppData: Mobile.IDeviceAppData, localToDevicePaths: Mobile.ILocalToDevicePathData[]): Promise<void> {
		let houseArrestClient: Mobile.IHouseArrestClient = this.$injector.resolve(iOSProxyServices.HouseArrestClient, { device: this.device });

		let afcClient = await this.getAfcClient(houseArrestClient, await deviceAppData.getDeviceProjectRootPath(), deviceAppData.appIdentifier);

		await Promise.all(
			_.map(localToDevicePaths, async (localToDevicePathData) => {
				let stats = this.$fs.getFsStats(localToDevicePathData.getLocalPath());
				if (stats.isFile()) {
					await afcClient.transfer(localToDevicePathData.getLocalPath(), localToDevicePathData.getDevicePath());
				}
			}));

		houseArrestClient.closeSocket();
	}

	public async transferDirectory(deviceAppData: Mobile.IDeviceAppData, localToDevicePaths: Mobile.ILocalToDevicePathData[], projectFilesPath: string): Promise<void> {
		return this.transferFiles(deviceAppData, localToDevicePaths);
	}

	private getAfcClient(houseArrestClient: Mobile.IHouseArrestClient, rootPath: string, appIdentifier: string): Promise<Mobile.IAfcClient> {
		if (rootPath.indexOf("/Documents/") === 0) {
			return houseArrestClient.getAfcClientForAppDocuments(appIdentifier);
		}

		return houseArrestClient.getAfcClientForAppContainer(appIdentifier);
	}

	private resolveAfc(): Mobile.IAfcClient {
		let service = this.$options.app ? this.startHouseArrestService(this.$options.app) : this.device.startService(iOSProxyServices.MobileServices.APPLE_FILE_CONNECTION);
		let afcClient: Mobile.IAfcClient = this.$injector.resolve(iOSProxyServices.AfcClient, { service: service });
		return afcClient;
	}

	private startHouseArrestService(bundleId: string): number {
		let func = () => {
			let fdRef = ref.alloc("int");
			let result = this.$mobileDevice.deviceStartHouseArrestService(this.devicePointer, this.$coreFoundation.createCFString(bundleId), null, fdRef);
			let fd = fdRef.deref();

			if (result !== 0) {
				this.$errors.fail("AMDeviceStartHouseArrestService returned %s", result);
			}

			return fd;
		};

		return this.device.tryExecuteFunction<number>(func);
	}
}
