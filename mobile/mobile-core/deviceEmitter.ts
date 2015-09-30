///<reference path="./../../.d.ts"/>
"use strict";

import { EventEmitter } from "events";
import byline = require("byline");
import fiberBootstrap = require("../../fiber-bootstrap");

class DeviceEmitter extends EventEmitter {
	private static DEVICE_DISCOVERY_TIMEOUT = 500;

	// TODO: add iOSDeviceDiscovery as a dependency too
	constructor(private $androidDeviceDiscovery:Mobile.IAndroidDeviceDiscovery,
		private $iOSDeviceDiscovery: Mobile.IDeviceDiscovery,
		private $childProcess: IChildProcess,
		private $devicesService: Mobile.IDevicesService,
		private $staticConfig: Config.IStaticConfig) {
		super();
	}

	public initialize(): IFuture<void> {
		return (() => {
			this.$androidDeviceDiscovery.ensureAdbServerStarted().wait();
			this.$androidDeviceDiscovery.on("deviceFound", (data: Mobile.IDevice) => {
				this.emit("deviceFound", data.deviceInfo);
			});

			this.$androidDeviceDiscovery.on("deviceLost", (data: Mobile.IDevice) => {
				this.emit("deviceLost", data.deviceInfo);
			});

			this.$iOSDeviceDiscovery.on("deviceFound", (data: Mobile.IDevice) => {
				this.emit("deviceFound", data.deviceInfo);
			});

			this.$iOSDeviceDiscovery.on("deviceLost", (data: Mobile.IDevice) => {
				this.emit("deviceLost", data.deviceInfo);
			});

			this.$iOSDeviceDiscovery.startLookingForDevices().wait();
			setInterval(() =>
				fiberBootstrap.run(() => {
					this.$androidDeviceDiscovery.startLookingForDevices().wait();
				}),
			DeviceEmitter.DEVICE_DISCOVERY_TIMEOUT).unref();

			this.startAdbLogcat().wait();

		}).future<void>()();
	}

	private startAdbLogcat(): IFuture<void> {
		return (() => {
			let adbPath = this.$staticConfig.getAdbFilePath().wait();

			let adbLogcat = this.$childProcess.spawn(adbPath, ["logcat"]);
			let lineStream = byline(adbLogcat.stdout);

			adbLogcat.stderr.on("data", (data: NodeBuffer) => {
				this.emit("adbError", data);
			});

			adbLogcat.on("adbClose", (code: number) => {
				this.emit("adbClose", code.toString());
			});

			lineStream.on('data', (line: NodeBuffer) => {
				let lineText = line.toString();
				this.emit("adbData", lineText);
			});

		}).future<void>()();
	}
}
$injector.register("deviceEmitter", DeviceEmitter);
