import {DeviceDiscovery} from "./device-discovery";
import * as helpers from "../../helpers";
import {AndroidDevice} from "../android/android-device";
import {EOL} from "os";
import Future = require("fibers/future");
import * as fiberBootstrap from "../../fiber-bootstrap";

interface IAdbAndroidDeviceInfo {
	identifier: string;
	status: string;
}

export class AndroidDeviceDiscovery extends DeviceDiscovery implements Mobile.IAndroidDeviceDiscovery {
	private _devices: IAdbAndroidDeviceInfo[] = [];
	private isStarted: boolean;

	constructor(private $childProcess: IChildProcess,
		private $injector: IInjector,
		private $adb: Mobile.IAndroidDebugBridge) {
		super();
	}

	private createAndAddDevice(adbDeviceInfo: IAdbAndroidDeviceInfo): void {
		this._devices.push(adbDeviceInfo);
		let device = this.$injector.resolve(AndroidDevice, { identifier: adbDeviceInfo.identifier, status: adbDeviceInfo.status });
		this.addDevice(device);
	}

	private deleteAndRemoveDevice(deviceIdentifier: string): void {
		_.remove(this._devices, d => d.identifier === deviceIdentifier);
		this.removeDevice(deviceIdentifier);
	}

	public async startLookingForDevices(): Promise<void> {
			await this.ensureAdbServerStarted();
			let blockingFuture = new Future<void>();
			await this.checkForDevices(blockingFuture);
	}

	public async async checkForDevices(future?: Promise<void>): Promise<void> {
		let adbData = "";

		let result = await  this.$adb.executeCommand(["devices"], { returnChildProcess: true });
		result.stdout.on("data", (data: NodeBuffer) => {
			adbData += data.toString();
		});

		result.stderr.on("data", (data: NodeBuffer) => {
			let error = new Error(data.toString());
			if (future && !future.isResolved()) {
				return future.throw(error);
			} else {
				throw (error);
			}
		});

		result.on("error", (err: Error) => {
			if (future && !future.isResolved()) {
				return future.throw(err);
			} else {
				throw (err);
			}
		});

		result.on("close", (exitCode: any) => {
			fiberBootstrap.run(() => {
				await this.checkCurrentData(adbData);
				if (future && !future.isResolved()) {
					future.return();
				}
			});
		});

		return future || Promise.resolve();
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

			_(currentDevices)
				.reject(d => _.find(this._devices, device => device.identifier === d.identifier && device.status === d.status))
				.each(d => this.createAndAddDevice(d));
	}

	public async ensureAdbServerStarted(): Promise<any> {
			if (!this.isStarted) {
				this.isStarted = true;

				try {
					await return this.$adb.executeCommand(["start-server"]);
				} catch (err) {
					this.isStarted = false;
					throw err;
				}
			}
	}
}
$injector.register("androidDeviceDiscovery", AndroidDeviceDiscovery);
