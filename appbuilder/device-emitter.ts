import { EventEmitter } from "events";

export class DeviceEmitter extends EventEmitter {
	constructor(private $androidDeviceDiscovery: Mobile.IAndroidDeviceDiscovery,
		private $iOSDeviceDiscovery: Mobile.IDeviceDiscovery,
		private $iOSSimulatorDiscovery: Mobile.IDeviceDiscovery,
		private $devicesService: Mobile.IDevicesService,
		private $deviceLogProvider: EventEmitter,
		private $companionAppsService: ICompanionAppsService,
		private $projectConstants: Project.IConstants,
		private $logger: ILogger) {
		super();
	}

	private _companionAppIdentifiers: IDictionary<IStringDictionary>;
	private get companionAppIdentifiers(): IDictionary<IStringDictionary> {
		if (!this._companionAppIdentifiers) {
			this._companionAppIdentifiers = this.$companionAppsService.getAllCompanionAppIdentifiers();
		}

		return this._companionAppIdentifiers;
	}

	public async initialize(): Promise<void> {
			try {
				await this.$androidDeviceDiscovery.ensureAdbServerStarted();
			} catch(err) {
				this.$logger.warn(`Unable to start adb server. Error message is: ${err.message}`);
			}

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

			await this.$devicesService.initialize({ skipInferPlatform: true });

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
