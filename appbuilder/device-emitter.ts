import { EventEmitter } from "events";
import { DeviceDiscoveryEventNames } from "../constants";

export class DeviceEmitter extends EventEmitter {
	constructor(private $deviceLogProvider: EventEmitter,
		private $devicesService: Mobile.IDevicesService,
		private $companionAppsService: ICompanionAppsService) {
		super();

		this.initialize();

	}

	private _companionAppIdentifiers: IDictionary<IStringDictionary>;
	private get companionAppIdentifiers(): IDictionary<IStringDictionary> {
		if (!this._companionAppIdentifiers) {
			this._companionAppIdentifiers = this.$companionAppsService.getAllCompanionAppIdentifiers();
		}

		return this._companionAppIdentifiers;
	}

	public initialize(): void {
		this.$devicesService.on(DeviceDiscoveryEventNames.DEVICE_FOUND, (device: Mobile.IDevice) => {
			this.emit(DeviceDiscoveryEventNames.DEVICE_FOUND, device.deviceInfo);
			this.attachApplicationChangedHandlers(device);

			// await: Do not await as this will require to mark the lambda with async keyword, but there's no way to await the lambda itself.
			device.openDeviceLogStream();
		});

		this.$devicesService.on(DeviceDiscoveryEventNames.DEVICE_LOST, (device: Mobile.IDevice) => {
			this.emit(DeviceDiscoveryEventNames.DEVICE_LOST, device.deviceInfo);
		});

		this.$deviceLogProvider.on("data", (identifier: string, data: any) => {
			this.emit('deviceLogData', identifier, data.toString());
		});
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

		device.applicationManager.on("debuggableAppFound", (debuggableAppInfo: Mobile.IDeviceApplicationInformation) => {
			this.emit("debuggableAppFound", debuggableAppInfo);
		});

		device.applicationManager.on("debuggableAppLost", (debuggableAppInfo: Mobile.IDeviceApplicationInformation) => {
			this.emit("debuggableAppLost", debuggableAppInfo);
		});

		device.applicationManager.on("debuggableViewFound", (appIdentifier: string, debuggableWebViewInfo: Mobile.IDebugWebViewInfo) => {
			this.emit("debuggableViewFound", device.deviceInfo.identifier, appIdentifier, debuggableWebViewInfo);
		});

		device.applicationManager.on("debuggableViewLost", (appIdentifier: string, debuggableWebViewInfo: Mobile.IDebugWebViewInfo) => {
			this.emit("debuggableViewLost", device.deviceInfo.identifier, appIdentifier, debuggableWebViewInfo);
		});

		device.applicationManager.on("debuggableViewChanged", (appIdentifier: string, debuggableWebViewInfo: Mobile.IDebugWebViewInfo) => {
			this.emit("debuggableViewChanged", device.deviceInfo.identifier, appIdentifier, debuggableWebViewInfo);
		});
	}

	private checkCompanionAppChanged(device: Mobile.IDevice, applicationName: string, eventName: string): void {
		let devicePlatform = device.deviceInfo.platform.toLowerCase();
		_.each(this.companionAppIdentifiers, (platformsCompanionAppIdentifiers: IStringDictionary, framework: string) => {
			if (applicationName === platformsCompanionAppIdentifiers[devicePlatform]) {
				this.emit(eventName, device.deviceInfo.identifier, framework);
				// break each
				return false;
			}
		});
	}
}
$injector.register("deviceEmitter", DeviceEmitter);
