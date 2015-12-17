///<reference path="./../../.d.ts"/>
"use strict";

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
	private _pathToAdb: string;
	private get pathToAdb(): string {
		if(!this._pathToAdb) {
			this._pathToAdb = this.$staticConfig.getAdbFilePath().wait();
		}

		return this._pathToAdb;
	}

	constructor(private $childProcess: IChildProcess,
		private $injector: IInjector,
		private $staticConfig: Config.IStaticConfig) {
		super();
	}

	private createAndAddDevice(adbDeviceInfo: IAdbAndroidDeviceInfo): void {
		this._devices.push(adbDeviceInfo);
		let device = this.$injector.resolve(AndroidDevice, { identifier: adbDeviceInfo.identifier, status: adbDeviceInfo.status });
		this.addDevice(device);
	}

	private deleteAndRemoveDevice(deviceIdentifier: string): void {
		_.remove(this._devices, d => d === deviceIdentifier);
		this.removeDevice(deviceIdentifier);
	}

	public startLookingForDevices(): IFuture<void> {
		this.ensureAdbServerStarted().wait();
		let blockingFuture = new Future<void>();
		return this.checkForDevices(blockingFuture);
	}

	public checkForDevices(future?: IFuture<void>): IFuture<void> {
		let result = this.$childProcess.spawn(this.pathToAdb, ["devices"], { stdio: 'pipe' });
		result.stdout.on("data", (data: NodeBuffer) => {
			fiberBootstrap.run(() => {
				this.checkCurrentData(data).wait();
				if(future) {
					future.return();
				}
			});
		});

		result.stderr.on("data", (data: NodeBuffer) => {
			let error = new Error(data.toString());
			if(future) {
				return future.throw(error);
			} else {
				throw(error);
			}
		});

		result.on("error", (err: Error) => {
			if(future) {
				return future.throw(err);
			} else {
				throw(err);
			}
		});

		return future || Future.fromResult();
	}

	private checkCurrentData(result: any): IFuture<void> {
		return (() => {
			let currentDevices: IAdbAndroidDeviceInfo[] = result.toString().split(EOL).slice(1)
				.filter( (element:string) => !helpers.isNullOrWhitespace(element) )
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

	public ensureAdbServerStarted(): IFuture<void> {
		return this.$childProcess.spawnFromEvent(this.$staticConfig.getAdbFilePath().wait(), ["start-server"], "close");
	}
}
$injector.register("androidDeviceDiscovery", AndroidDeviceDiscovery);
