import { DeviceDiscovery } from "./device-discovery";
import * as helpers from "../../helpers";
import { AndroidDevice } from "../android/android-device";
import { EOL } from "os";

interface IAdbAndroidDeviceInfo {
	identifier: string;
	status: string;
}

export class AndroidDeviceDiscovery extends DeviceDiscovery implements Mobile.IAndroidDeviceDiscovery {
	private _devices: IAdbAndroidDeviceInfo[] = [];
	private isStarted: boolean;

	constructor(private $injector: IInjector,
		private $adb: Mobile.IAndroidDebugBridge) {
		super();
	}

	private async createAndAddDevice(adbDeviceInfo: IAdbAndroidDeviceInfo): Promise<void> {
		this._devices.push(adbDeviceInfo);
		let device = this.$injector.resolve(AndroidDevice, { identifier: adbDeviceInfo.identifier, status: adbDeviceInfo.status });
		await device.init();
		this.addDevice(device);
	}

	private deleteAndRemoveDevice(deviceIdentifier: string): void {
		_.remove(this._devices, d => d.identifier === deviceIdentifier);
		this.removeDevice(deviceIdentifier);
	}

	public async startLookingForDevices(): Promise<void> {
		await this.ensureAdbServerStarted();
		let blockingFuture = new Promise<void>((resolve, reject) => {
			this.checkForDevices(resolve, reject);
		});

		return blockingFuture;
	}

	public async checkForDevices(resolve?: (value?: void | PromiseLike<void>) => void, reject?: (reason?: any) => void): Promise<void> {
		let adbData = "";
		let isResolved = false;

		let result = await this.$adb.executeCommand(["devices"], { returnChildProcess: true });

		result.stdout.on("data", (data: NodeBuffer) => {
			adbData += data.toString();
		});

		result.stderr.on("data", (data: NodeBuffer) => {
			let error = new Error(data.toString());
			if (reject && !isResolved) {
				isResolved = true;
				return reject(error);
			} else {
				throw (error);
			}
		});

		result.on("error", (error: Error) => {
			if (reject && !isResolved) {
				isResolved = true;
				return reject(error);
			} else {
				throw (error);
			}
		});

		result.on("close", async (exitCode: any) => {
			await this.checkCurrentData(adbData);

			if (resolve && !isResolved) {
				isResolved = true;
				return resolve();
			}
		});
	}

	private async checkCurrentData(result: any): Promise<void> {
		let currentDevices: IAdbAndroidDeviceInfo[] = result.toString().split(EOL).slice(1)
			.filter((element: string) => !helpers.isNullOrWhitespace(element))
			.map((element: string) => {
				// http://developer.android.com/tools/help/adb.html#devicestatus
				let data = element.split('\t'),
					identifier = data[0],
					status = data[1];
				return {
					identifier: identifier,
					status: status
				};
			});

		_(this._devices)
			.reject(d => _.find(currentDevices, device => device.identifier === d.identifier && device.status === d.status))
			.each(d => this.deleteAndRemoveDevice(d.identifier));

		await Promise.all(_(currentDevices)
			.reject(d => _.find(this._devices, device => device.identifier === d.identifier && device.status === d.status))
			.map(d => this.createAndAddDevice(d)).value());
	}

	public async ensureAdbServerStarted(): Promise<any> {
		if (!this.isStarted) {
			this.isStarted = true;

			try {
				return await this.$adb.executeCommand(["start-server"]);
			} catch (err) {
				this.isStarted = false;
				throw err;
			}
		}
	}
}

$injector.register("androidDeviceDiscovery", AndroidDeviceDiscovery);
