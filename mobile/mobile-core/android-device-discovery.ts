///<reference path="./../../.d.ts"/>
"use strict";

import {DeviceDiscovery} from "./device-discovery"
import * as helpers from "../../helpers";
import {AndroidDevice} from "../android/android-device";
import {EOL} from "os";

export class AndroidDeviceDiscovery extends DeviceDiscovery implements Mobile.IAndroidDeviceDiscovery {
	private _devices: string[] = [];

	constructor(private $childProcess: IChildProcess,
		private $injector: IInjector,
		private $staticConfig: Config.IStaticConfig) {
		super();
	}

	private createAndAddDevice(deviceIdentifier: string): void {
		this._devices.push(deviceIdentifier);
		let device = this.$injector.resolve(AndroidDevice, { identifier: deviceIdentifier });
		this.addDevice(device);
	}

	private deleteAndRemoveDevice(deviceIdentifier: string): void {
		_.remove(this._devices, d => d === deviceIdentifier);
		this.removeDevice(deviceIdentifier);
	}

	public startLookingForDevices(): IFuture<void> {
		return(()=> {
			let requestAllDevicesCommand = `"${this.$staticConfig.getAdbFilePath().wait()}" devices`;
			let result = this.$childProcess.exec(requestAllDevicesCommand).wait();

			let currentDevices = result.toString().split(EOL).slice(1)
				.filter( (element:string) => !helpers.isNullOrWhitespace(element) )
				.map((element: string) => {
					// http://developer.android.com/tools/help/adb.html#devicestatus
					let parts = element.split("\t");
					let identifier = parts[0];
					let state = parts[1];
					if (state === "device"/*ready*/) {
						return identifier;
					}
				});

			let oldDevices = _.difference(this._devices, currentDevices),
				newDevices = _.difference(currentDevices, this._devices);

			_.each(newDevices, d => this.createAndAddDevice(d));
			_.each(oldDevices, d => this.deleteAndRemoveDevice(d));
		}).future<void>()();
	}

	public ensureAdbServerStarted(): IFuture<void> {
		let startAdbServerCommand = `"${this.$staticConfig.getAdbFilePath().wait()}" start-server`;
		return this.$childProcess.exec(startAdbServerCommand);
	}
}
$injector.register("androidDeviceDiscovery", AndroidDeviceDiscovery);

