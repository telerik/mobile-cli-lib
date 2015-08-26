///<reference path="../../.d.ts"/>
"use strict";

import { EventEmitter } from "events";

export class DeviceDiscovery extends EventEmitter implements Mobile.IDeviceDiscovery {
	private devices: {[key: string]: Mobile.IDevice} = {};

	public addDevice(device: Mobile.IDevice) {
		this.devices[device.deviceInfo.identifier] = device;
		this.raiseOnDeviceFound(device);
	}

	public removeDevice(deviceIdentifier: string) {
		let device = this.devices[deviceIdentifier];
		if(!device) {
			return;
		}
		delete this.devices[deviceIdentifier];
		this.raiseOnDeviceLost(device);
	}

	public startLookingForDevices(): IFuture<void> {
		return undefined;
	}

	private raiseOnDeviceFound(device: Mobile.IDevice) {
		this.emit("deviceFound", device);
	}

	private raiseOnDeviceLost(device: Mobile.IDevice) {
		this.emit("deviceLost", device);
	}
}
$injector.register("deviceDiscovery", DeviceDiscovery);
