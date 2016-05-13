///<reference path="../.d.ts"/>
"use strict";

import { EventEmitter } from "events";

class DeviceEmitter extends EventEmitter {
	constructor(private $androidDeviceDiscovery:Mobile.IAndroidDeviceDiscovery,
		private $iOSDeviceDiscovery: Mobile.IDeviceDiscovery,
		private $iOSSimulatorDiscovery: Mobile.IDeviceDiscovery,
		private $devicesService: Mobile.IDevicesService,
		private $deviceLogProvider: EventEmitter,
		private $companionAppsService: ICompanionAppsService,
		private $projectConstants: Project.IConstants,
		private $devicePlatformsConstants: Mobile.IDevicePlatformsConstants) {
		super();
	}

	private _companionAppIdentifiers: IDictionary<IStringDictionary>;
	private get companionAppIdentifiers(): IDictionary<IStringDictionary> {
		if(!this._companionAppIdentifiers) {
			this._companionAppIdentifiers = this.$companionAppsService.getAllCompanionAppIdentifiers();
		}

		return this._companionAppIdentifiers;
	}

	public initialize(): IFuture<void> {
		return (() => {
			this.$androidDeviceDiscovery.ensureAdbServerStarted().wait();
			this.$androidDeviceDiscovery.on("deviceFound", (device: Mobile.IDevice) => {
				this.emit("deviceFound", device.deviceInfo);
				this.attachApplicationChangedHandlers(device);
				device.openDeviceLogStream();
			});

			this.$androidDeviceDiscovery.on("deviceLost", (device: Mobile.IDevice) => {
				this.emit("deviceLost", device.deviceInfo);
			});

			this.$iOSDeviceDiscovery.on("deviceFound", (device: Mobile.IDevice) => {
				this.emit("deviceFound", device.deviceInfo);
				this.attachApplicationChangedHandlers(device);
				device.openDeviceLogStream();
			});

			this.$iOSDeviceDiscovery.on("deviceLost", (device: Mobile.IDevice) => {
				this.emit("deviceLost", device.deviceInfo);
			});

			this.$iOSSimulatorDiscovery.on("deviceFound", (device: Mobile.IDevice) => {
				this.emit("deviceFound", device.deviceInfo);
				device.openDeviceLogStream();
				this.attachApplicationChangedHandlers(device);
			});

			this.$iOSSimulatorDiscovery.on("deviceLost", (device: Mobile.IDevice) => {
				this.emit("deviceLost", device.deviceInfo);
			});

			this.$devicesService.initialize({skipInferPlatform: true}).wait();

			this.$deviceLogProvider.on("data", (identifier: string, data: any) => {
				this.emit('deviceLogData', identifier, data.toString());
			});
		}).future<void>()();
	}

	private attachApplicationChangedHandlers(device: Mobile.IDevice): void {
		device.applicationManager.on("applicationInstalled", (appIdentifier: string) => {
			this.emit("applicationInstalled", device.deviceInfo.identifier, appIdentifier);
			this.checkCompanionAppChanged(device, appIdentifier, "companionAppInstalled");
		});

		device.applicationManager.on("applicationUninstalled", (appIdentifier: string) => {
			this.emit("applicationUninstalled", device.deviceInfo.identifier, appIdentifier);
			this.checkCompanionAppChanged(device, appIdentifier, "companionAppUninstalled");
		});
	}

	private checkCompanionAppChanged(device: Mobile.IDevice, applicationName: string, eventName: string): void {
		let devicePlatform = device.deviceInfo.platform.toLowerCase();
		_.each(this.companionAppIdentifiers, (platformsCompanionAppIdentifiers: IStringDictionary, framework: string) => {
			if(applicationName === platformsCompanionAppIdentifiers[devicePlatform]) {
				this.emit(eventName, device.deviceInfo.identifier, framework);
				// break each
				return false;
			}
		});
	}
}
$injector.register("deviceEmitter", DeviceEmitter);
