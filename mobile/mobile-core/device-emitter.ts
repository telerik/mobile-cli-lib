///<reference path="./../../.d.ts"/>
"use strict";

import { EventEmitter } from "events";
import byline = require("byline");
import fiberBootstrap = require("../../fiber-bootstrap");

class DeviceEmitter extends EventEmitter {
	private static DEVICE_DISCOVERY_TIMEOUT = 500;

	constructor(private $androidDeviceDiscovery:Mobile.IAndroidDeviceDiscovery,
		private $iOSDeviceDiscovery: Mobile.IDeviceDiscovery,
		private $childProcess: IChildProcess,
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

			fiberBootstrap.run(() => {
				this.$devicesService.initialize({skipInferPlatform: true}).wait();
			});

			this.$deviceLogProvider.on("data", (identifier: string, data: any) => {
				this.emit('deviceLogData', identifier, data.toString());
			});
		}).future<void>()();
	}
}
$injector.register("deviceEmitter", DeviceEmitter);
