///<reference path="./../../.d.ts"/>
"use strict";

import {DeviceDiscovery} from "./device-discovery";
import * as helpers from "../../helpers";
import {AndroidDevice} from "../android/android-device";
import {EOL} from "os";
import Future = require("fibers/future");
import fiberBootstrap = require("../../fiber-bootstrap");

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
		return this.checkForDevices();
	}

	public checkForDevices(): IFuture<void> {
		return (() => {
			let result = this.$childProcess.spawn(this.$staticConfig.getAdbFilePath().wait(), ["devices"], { stdio: 'pipe' });
			result.stdout.on("data", (data: NodeBuffer) => {
				fiberBootstrap.run(() => {
					this.checkCurrentData(data).wait();
				});
			});

			result.stderr.on("data", (data: NodeBuffer) => {
				throw(new Error(data.toString()));
			});

			result.on("error", (err: Error) => {
				throw(err);
			});
		}).future<void>()();
	}

	private checkCurrentData(result: any): IFuture<void> {
		return (() => {
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
