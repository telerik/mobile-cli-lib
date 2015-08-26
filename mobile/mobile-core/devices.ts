///<reference path="./../../.d.ts"/>
"use strict";

import { EventEmitter } from "events";

class Devices extends EventEmitter {
	// TODO: add iosDeviceDiscovery as a dependency too
	constructor(private $androidDeviceDiscovery:Mobile.IAndroidDeviceDiscovery) {
		super();
	}
	
	public initialize(): IFuture<void> {
		return (() => {
			this.$androidDeviceDiscovery.ensureAdbServerStarted().wait();
			
			setInterval(() => this.$androidDeviceDiscovery.startLookingForDevices(), 1000); // Maybe we should unref this as it will block CLI's execution and will hold the console.
			this.$androidDeviceDiscovery.on("deviceFound", (data: Mobile.IDevice) => {
				this.emit("deviceFound", data.deviceInfo);
			});
			
			this.$androidDeviceDiscovery.on("deviceLost", (data: Mobile.IDevice) => {
				this.emit("deviceLost", data.deviceInfo);
			});
		}).future<void>()();
	}

	// TODO: Expose list of all devices (use deviceInfo for each device in devicesServices.devices)
}
$injector.register("devices", Devices);

