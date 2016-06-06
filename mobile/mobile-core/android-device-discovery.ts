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

	public startLookingForDevices(): IFuture<void> {
		return (() => {
			this.ensureAdbServerStarted().wait();
			let blockingFuture = new Future<void>();
			this.checkForDevices(blockingFuture).wait();
		}).future<void>()();
	}

	public checkForDevices(future?: IFuture<void>): IFuture<void> {
		let adbData = "";

		let result = this.$adb.executeCommand(["devices"], { returnChildProcess: true }).wait();
		result.stdout.on("data", (data: NodeBuffer) => {
			adbData += data.toString();
		});

		result.stderr.on("data", (data: NodeBuffer) => {
			let error = new Error(data.toString());
			if (future) {
				return future.throw(error);
			} else {
				throw (error);
			}
		});

		result.on("error", (err: Error) => {
			if (future) {
				return future.throw(err);
			} else {
				throw (err);
			}
		});

		result.on("close", (exitCode: any) => {
			fiberBootstrap.run(() => {
				this.checkCurrentData(adbData).wait();
				if (future) {
					future.return();
				}
			});
		});

		return future || Future.fromResult();
	}

	private checkCurrentData(result: any): IFuture<void> {
		return (() => {
			let currentDevices: IAdbAndroidDeviceInfo[] = result.toString().split(EOL).slice(1)
				.filter((element: string) => !helpers.isNullOrWhitespace(element))
				.map((element: string) => {
					// http://developer.android.com/tools/help/adb.html#devicestatus
					let [identifier, status] = element.split('\t');
					return {
						identifier: identifier,
						status: status
					};
				});

			_(this._devices)
				.reject(d => _.find(currentDevices, device => device.identifier === d.identifier && device.status === d.status))
				.each(d => this.deleteAndRemoveDevice(d.identifier))
				.value();

			_(currentDevices)
				.reject(d => _.find(this._devices, device => device.identifier === d.identifier && device.status === d.status))
				.each(d => this.createAndAddDevice(d))
				.value();
		}).future<void>()();
	}

	public ensureAdbServerStarted(): IFuture<any> {
		return ((): any => {
			if (!this.isStarted) {
				this.isStarted = true;

				try {
					return this.$adb.executeCommand(["start-server"]).wait();
				} catch (err) {
					this.isStarted = false;
					throw err;
				}
			}
		}).future<any>()();
	}
}
$injector.register("androidDeviceDiscovery", AndroidDeviceDiscovery);
