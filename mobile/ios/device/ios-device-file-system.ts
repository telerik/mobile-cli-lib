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

	public listFiles(devicePath: string, appIdentifier?: string): IFuture<any> {
		return (() => {
			if (!devicePath) {
				devicePath = ".";
			}

			this.$logger.info("Listing %s", devicePath);

			let afcClient = this.resolveAfc();

			let walk = (root:string, indent:number) => {
				this.$logger.info(util.format("%s %s", Array(indent).join(" "), root));
				let children:string[] = [];
				try {
					children = afcClient.listDir(root);
				} catch (e) {
					children = [];
				}

				_.each(children, (child:string) => {
					walk(root + "/" + child, indent + 1);
				});
			};

			walk(devicePath, 0);
		}).future<any>()();
	}

	public getFile(deviceFilePath: string): IFuture<void> {
		return (() => {
			let afcClient = this.resolveAfc();
			let fileToRead = afcClient.open(deviceFilePath, "r");
			let fileToWrite = this.$options.file ? this.$fs.createWriteStream(this.$options.file) : process.stdout;
			let dataSizeToRead = 8192;
			let size = 0;

			while(true) {
				let data = fileToRead.read(dataSizeToRead);
				if(!data || data.length === 0) {
					break;
				}
				fileToWrite.write(data);
				size += data.length;
			}

			fileToRead.close();
			this.$logger.trace("%s bytes read from %s", size.toString(), deviceFilePath);

		}).future<void>()();
	}

	public putFile(localFilePath: string, deviceFilePath: string): IFuture<void> {
		let afcClient = this.resolveAfc();
		return afcClient.transfer(path.resolve(localFilePath), deviceFilePath);
	}

	public deleteFile(deviceFilePath: string, appIdentifier: string): void {
		let houseArrestClient: Mobile.IHouseArrestClient = this.$injector.resolve(iOSProxyServices.HouseArrestClient, {device: this.device});
		let afcClientForContainer = houseArrestClient.getAfcClientForAppContainer(appIdentifier);
		afcClientForContainer.deleteFile(deviceFilePath);
		houseArrestClient.closeSocket();
	}

	public transferFiles(deviceAppData: Mobile.IDeviceAppData, localToDevicePaths: Mobile.ILocalToDevicePathData[]): IFuture<void> {
		return (() => {
			let houseArrestClient: Mobile.IHouseArrestClient = this.$injector.resolve(iOSProxyServices.HouseArrestClient, { device: this.device });
			let afcClientForAppContainer = houseArrestClient.getAfcClientForAppContainer(deviceAppData.appIdentifier);

			let files = localToDevicePaths
				.map(d => ({from: d.getLocalPath(), to: d.getDevicePath() }))
				.filter(p => this.$fs.getFsStats(p.from).wait().isFile());

			afcClientForAppContainer.transferFiles(files).wait();

			houseArrestClient.closeSocket();
		}).future<void>()();
	}

	public transferDirectory(deviceAppData: Mobile.IDeviceAppData, localToDevicePaths: Mobile.ILocalToDevicePathData[], projectFilesPath: string): IFuture<void> {
		return this.transferFiles(deviceAppData, localToDevicePaths);
	}

	private resolveAfc(): Mobile.IAfcClient {
		let service = this.$options.app ? this.startHouseArrestService(this.$options.app) : this.device.startService(iOSProxyServices.MobileServices.APPLE_FILE_CONNECTION);
		let afcClient:Mobile.IAfcClient = this.$injector.resolve(iOSProxyServices.AfcClient, {service: service});
		return afcClient;
	}

	private startHouseArrestService(bundleId: string): number {
		let func = () => {
			let fdRef = ref.alloc("int");
			let result = this.$mobileDevice.deviceStartHouseArrestService(this.devicePointer, this.$coreFoundation.createCFString(bundleId), null, fdRef);
			let fd = fdRef.deref();

			if(result !== 0) {
				this.$errors.fail("AMDeviceStartHouseArrestService returned %s", result);
			}

			return fd;
		};

		return this.device.tryExecuteFunction<number>(func);
	}
}
