///<reference path="../.d.ts"/>
"use strict";

import { EventEmitter } from "events";

class DeviceEmitter extends EventEmitter {
	constructor(private $androidDeviceDiscovery:Mobile.IAndroidDeviceDiscovery,
		private $iOSDeviceDiscovery: Mobile.IDeviceDiscovery,
		private $devicesService: Mobile.IDevicesService,
		private $deviceLogProvider: EventEmitter) {
		super();
	}

	public initialize(): IFuture<void> {
		return (() => {
			this.$androidDeviceDiscovery.ensureAdbServerStarted().wait();
			this.$androidDeviceDiscovery.on("deviceFound", (data: Mobile.IDevice) => {
				this.emit("deviceFound", data.deviceInfo);
				data.openDeviceLogStream();
			});

			this.$androidDeviceDiscovery.on("deviceLost", (data: Mobile.IDevice) => {
				this.emit("deviceLost", data.deviceInfo);
			});

			this.$iOSDeviceDiscovery.on("deviceFound", (data: Mobile.IDevice) => {
				this.emit("deviceFound", data.deviceInfo);
				data.openDeviceLogStream();
			});

			this.$iOSDeviceDiscovery.on("deviceLost", (data: Mobile.IDevice) => {
				this.emit("deviceLost", data.deviceInfo);
			});

			this.$devicesService.initialize({skipInferPlatform: true}).wait();

			this.$deviceLogProvider.on("data", (identifier: string, data: any) => {
				this.emit('deviceLogData', identifier, data.toString());
			});
		}).future<void>()();
	}
}
$injector.register("deviceEmitter", DeviceEmitter);
