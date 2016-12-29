import * as util from "util";
import Future = require("fibers/future");
import * as helpers from "../../helpers";
import * as assert from "assert";
import * as constants from "../../constants";
import * as fiberBootstrap from "../../fiber-bootstrap";
import {exportedPromise, exported} from "../../decorators";

export class DevicesService implements Mobile.IDevicesService {
	private static DEVICE_LOOKING_INTERVAL = 2200;
	private _devices: IDictionary<Mobile.IDevice> = {};
	private platforms: string[] = [];
	private _platform: string;
	private _device: Mobile.IDevice;
	private _isInitialized = false;
	private _data: Mobile.IDevicesServicesInitializationOptions;
	private deviceDetectionInterval: any;
	private deviceDetectionIntervalFuture: IFuture<void>;

	private get $companionAppsService(): ICompanionAppsService {
		return this.$injector.resolve("companionAppsService");
	}

	constructor(private $logger: ILogger,
		private $errors: IErrors,
		private $iOSSimulatorDiscovery: Mobile.IDeviceDiscovery,
		private $iOSDeviceDiscovery: Mobile.IDeviceDiscovery,
		private $androidDeviceDiscovery: Mobile.IDeviceDiscovery,
		private $staticConfig: Config.IStaticConfig,
		private $messages: IMessages,
		private $mobileHelper: Mobile.IMobileHelper,
		private $deviceLogProvider: Mobile.IDeviceLogProvider,
		private $hostInfo: IHostInfo,
		private $devicePlatformsConstants: Mobile.IDevicePlatformsConstants,
		private $injector: IInjector,
		private $options: ICommonOptions,
		private $androidProcessService: Mobile.IAndroidProcessService,
		private $processService: IProcessService) {
		this.attachToDeviceDiscoveryEvents();
	}

	public get platform(): string {
		return this._platform;
	}

	public get deviceCount(): number {
		return this._device ? 1 : this.getDeviceInstances().length;
	}

	@exported("devicesService")
	public getDevices(): Mobile.IDeviceInfo[] {
		return this.getDeviceInstances().map(deviceInstance => deviceInstance.deviceInfo);
	}

	public getDevicesForPlatform(platform: string): Mobile.IDevice[] {
		return _.filter(this.getDeviceInstances(), d => d.deviceInfo.platform.toLowerCase() === platform.toLowerCase());
	}

	public isAndroidDevice(device: Mobile.IDevice): boolean {
		return this.$mobileHelper.isAndroidPlatform(device.deviceInfo.platform);
	}

	public isiOSDevice(device: Mobile.IDevice): boolean {
		return this.$mobileHelper.isiOSPlatform(device.deviceInfo.platform) && !device.isEmulator;
	}

	public isiOSSimulator(device: Mobile.IDevice): boolean {
		return !!(this.$mobileHelper.isiOSPlatform(device.deviceInfo.platform) && device.isEmulator);
	}

	/* tslint:disable:no-unused-variable */
	@exported("devicesService")
	public setLogLevel(logLevel: string, deviceIdentifier?: string): void {
		this.$deviceLogProvider.setLogLevel(logLevel, deviceIdentifier);
	}
	/* tslint:enable:no-unused-variable */

	@exportedPromise("devicesService")
	public isAppInstalledOnDevices(deviceIdentifiers: string[], appIdentifier: string, framework: string): IFuture<IAppInstalledInfo>[] {
		this.$logger.trace(`Called isInstalledOnDevices for identifiers ${deviceIdentifiers}. AppIdentifier is ${appIdentifier}. Framework is: ${framework}.`);
		return _.map(deviceIdentifiers, deviceIdentifier => this.isApplicationInstalledOnDevice(deviceIdentifier, appIdentifier, framework));
	}

	@exportedPromise("devicesService")
	public isCompanionAppInstalledOnDevices(deviceIdentifiers: string[], framework: string): IFuture<IAppInstalledInfo>[] {
		this.$logger.trace(`Called isCompanionAppInstalledOnDevices for identifiers ${deviceIdentifiers}. Framework is ${framework}.`);
		return _.map(deviceIdentifiers, deviceIdentifier => this.isCompanionAppInstalledOnDevice(deviceIdentifier, framework));
	}

	public getDeviceInstances(): Mobile.IDevice[] {
		return _.values(this._devices);
	}

	private getAllPlatforms(): Array<string> {
		if (this.platforms.length > 0) {
			return this.platforms;
		}

		this.platforms = _.filter(this.$mobileHelper.platformNames, platform => this.$mobileHelper.getPlatformCapabilities(platform).cableDeploy);
		return this.platforms;
	}

	private getPlatform(platform: string): string {
		let allSupportedPlatforms = this.getAllPlatforms();
		let normalizedPlatform = this.$mobileHelper.validatePlatformName(platform);
		if (!_.includes(allSupportedPlatforms, normalizedPlatform)) {
			this.$errors.failWithoutHelp("Deploying to %s connected devices is not supported. Build the " +
				"app using the `build` command and deploy the package manually.", normalizedPlatform);
		}

		return normalizedPlatform;
	}

	private attachToDeviceDiscoveryEvents(): void {
		this.$iOSSimulatorDiscovery.on("deviceFound", (device: Mobile.IDevice) => this.onDeviceFound(device));
		this.$iOSSimulatorDiscovery.on("deviceLost", (device: Mobile.IDevice) => this.onDeviceLost(device));

		this.$iOSDeviceDiscovery.on("deviceFound", (device: Mobile.IDevice) => this.onDeviceFound(device));
		this.$iOSDeviceDiscovery.on("deviceLost", (device: Mobile.IDevice) => this.onDeviceLost(device));

		this.$androidDeviceDiscovery.on("deviceFound", (device: Mobile.IDevice) => this.onDeviceFound(device));
		this.$androidDeviceDiscovery.on("deviceLost", (device: Mobile.IDevice) => this.onDeviceLost(device));
	}

	private onDeviceFound(device: Mobile.IDevice): void {
		this.$logger.trace("Found device with identifier '%s'", device.deviceInfo.identifier);
		this._devices[device.deviceInfo.identifier] = device;
	}

	private onDeviceLost(device: Mobile.IDevice): void {
		this.$logger.trace("Lost device with identifier '%s'", device.deviceInfo.identifier);
		delete this._devices[device.deviceInfo.identifier];
	}

	public async detectCurrentlyAttachedDevices(): Promise<void> {
			try {
				this.$iOSDeviceDiscovery.startLookingForDevices().wait();
				this.$androidDeviceDiscovery.startLookingForDevices().wait();
				if (this.$hostInfo.isDarwin) {
					this.$iOSSimulatorDiscovery.startLookingForDevices().wait();
				}
			} catch (err) {
				this.$logger.trace("Error while detecting devices.", err);
			}
	}

	public startDeviceDetectionInterval(): void {
		this.$processService.attachToProcessExitSignals(this, this.clearDeviceDetectionInterval);

		if (this.deviceDetectionInterval) {
			this.$logger.trace("Device detection interval is already started. New Interval will not be started.");
		} else {
			this.deviceDetectionInterval = setInterval(() => {
				fiberBootstrap.run(() => {
					if (this.deviceDetectionIntervalFuture) {
						return;
					}

					this.deviceDetectionIntervalFuture = new Future<void>();

					try {
						this.$iOSDeviceDiscovery.checkForDevices().wait();
					} catch (err) {
						this.$logger.trace("Error while checking for new iOS devices.", err);
					}

					try {
						this.$androidDeviceDiscovery.startLookingForDevices().wait();
					} catch (err) {
						this.$logger.trace("Error while checking for new Android devices.", err);
					}

					try {
						if (this.$hostInfo.isDarwin) {
							this.$iOSSimulatorDiscovery.checkForDevices().wait();
						}
					} catch (err) {
						this.$logger.trace("Error while checking for new iOS Simulators.", err);
					}

					_.each(this._devices, device => {
						try {
							device.applicationManager.checkForApplicationUpdates().wait();
						} catch (err) {
							this.$logger.trace(`Error checking for application updates on device ${device.deviceInfo.identifier}.`, err);
						}
					});

					this.deviceDetectionIntervalFuture.return();
					this.deviceDetectionIntervalFuture.wait();
					this.deviceDetectionIntervalFuture = null;
				});
			}, DevicesService.DEVICE_LOOKING_INTERVAL).unref();
		}
	}

	public async stopDeviceDetectionInterval(): Promise<void> {
			this.clearDeviceDetectionInterval();
			this.deviceDetectionInterval = null;
			this.getDeviceDetectionIntervalFuture().wait();
	}

	public getDeviceByIdentifier(identifier: string): Mobile.IDevice {
		let searchedDevice = _.find(this.getDeviceInstances(), (device: Mobile.IDevice) => { return device.deviceInfo.identifier === identifier; });
		if (!searchedDevice) {
			this.$errors.fail(this.$messages.Devices.NotFoundDeviceByIdentifierErrorMessageWithIdentifier, identifier, this.$staticConfig.CLIENT_NAME.toLowerCase());
		}

		return searchedDevice;
	}

	public getDeviceByName(name: string): Mobile.IDevice {
		return _.find(this.getDeviceInstances(), (device: Mobile.IDevice) => { return device.deviceInfo.displayName === name; });
	}

	private async startLookingForDevices(): Promise<void> {
			this.$logger.trace("startLookingForDevices; platform is %s", this._platform);
			if (!this._platform) {
				this.detectCurrentlyAttachedDevices().wait();
				this.startDeviceDetectionInterval();
			} else if (this.$mobileHelper.isiOSPlatform(this._platform)) {
				this.$iOSDeviceDiscovery.startLookingForDevices().wait();
				if (this.$hostInfo.isDarwin) {
					this.$iOSSimulatorDiscovery.startLookingForDevices().wait();
				}
			} else if (this.$mobileHelper.isAndroidPlatform(this._platform)) {
				this.$androidDeviceDiscovery.startLookingForDevices().wait();
			}
	}

	private getDeviceByIndex(index: number): Mobile.IDevice {
		this.validateIndex(index - 1);
		return this.getDeviceInstances()[index - 1];
	}

	private async getDevice(deviceOption: string): Promise<Mobile.IDevice> {
			this.detectCurrentlyAttachedDevices().wait();
			let device: Mobile.IDevice = null;

			if (this.hasDevice(deviceOption)) {
				device = this.getDeviceByIdentifier(deviceOption);
			} else if (helpers.isNumber(deviceOption)) {
				device = this.getDeviceByIndex(parseInt(deviceOption, 10));
			} else {
				device = this.getDeviceByName(deviceOption);
			}

			if (!device) {
				this.$errors.fail(this.$messages.Devices.NotFoundDeviceByIdentifierErrorMessage, this.$staticConfig.CLIENT_NAME.toLowerCase());
			}

			return device;
	}

	private async executeOnDevice(action: (dev: Mobile.IDevice) => IFuture<void>, canExecute?: (_dev: Mobile.IDevice) => boolean): Promise<void> {
			if (!canExecute || canExecute(this._device)) {
				action(this._device).wait();
			}
	}

	private async executeOnAllConnectedDevices(action: (dev: Mobile.IDevice) => IFuture<void>, canExecute?: (_dev: Mobile.IDevice) => boolean): Promise<void> {
			let devices = this.filterDevicesByPlatform();
			let sortedDevices = _.sortBy(devices, device => device.deviceInfo.platform);

			let futures = _.map(sortedDevices, (device: Mobile.IDevice) => {
				if (!canExecute || canExecute(device)) {
					let future = action(device);
					Future.settle(future);
					return future;
				} else {
					return Future.fromResult();
				}
			});

			Future.wait(futures);
	}

	@exportedPromise("devicesService", function () {
		this.startDeviceDetectionInterval();
	})
	public deployOnDevices(deviceIdentifiers: string[], packageFile: string, packageName: string, framework: string): IFuture<void>[] {
		this.$logger.trace(`Called deployOnDevices for identifiers ${deviceIdentifiers} for packageFile: ${packageFile}. packageName is ${packageName}.`);
		return _.map(deviceIdentifiers, deviceIdentifier => this.deployOnDevice(deviceIdentifier, packageFile, packageName, framework));
	}

	public async execute(action: (device: Mobile.IDevice) => IFuture<void>, canExecute?: (dev: Mobile.IDevice) => boolean, options?: { allowNoDevices?: boolean }): Promise<void> {
			assert.ok(this._isInitialized, "Devices services not initialized!");
			if (this.hasDevices) {
				if (this.$hostInfo.isDarwin && this._platform && this.$mobileHelper.isiOSPlatform(this._platform) &&
					this.$options.emulator && !this.isOnlyiOSSimultorRunning()) {
					this.startEmulator().wait();
					// Executes the command only on iOS simulator
					let originalCanExecute = canExecute;
					canExecute = (dev: Mobile.IDevice): boolean => this.isiOSSimulator(dev) && (!originalCanExecute || !!(originalCanExecute(dev)));
				}
				this.executeCore(action, canExecute).wait();
			} else {
				let message = constants.ERROR_NO_DEVICES;
				if (options && options.allowNoDevices) {
					this.$logger.info(message);
				} else {
					if (!this.$hostInfo.isDarwin && this._platform && this.$mobileHelper.isiOSPlatform(this._platform)) {
						this.$errors.failWithoutHelp(message);
					} else {
						this.startEmulator().wait();
						this.executeCore(action, canExecute).wait();
					}
				}
			}
	}

	public initialize(data?: Mobile.IDevicesServicesInitializationOptions): IFuture<void> {
		if (this._isInitialized) {
			return Future.fromResult();
		}
		return (() => {
			data = data || {};
			this._data = data;
			let platform = data.platform;
			let deviceOption = data.deviceId;

			if (platform && deviceOption) {
				this._device = this.getDevice(deviceOption).wait();
				this._platform = this._device.deviceInfo.platform;
				if (this._platform !== this.getPlatform(platform)) {
					this.$errors.fail("Cannot resolve the specified connected device. The provided platform does not match the provided index or identifier." +
						"To list currently connected devices and verify that the specified pair of platform and index or identifier exists, run 'device'.");
				}
				this.$logger.warn("Your application will be deployed only on the device specified by the provided index or identifier.");
			} else if (!platform && deviceOption) {
				this._device = this.getDevice(deviceOption).wait();
				this._platform = this._device.deviceInfo.platform;
			} else if (platform && !deviceOption) {
				this._platform = this.getPlatform(platform);
				this.startLookingForDevices().wait();
			} else {
				// platform and deviceId are not specified
				if (data.skipInferPlatform) {
					this.startLookingForDevices().wait();
				} else {
					this.detectCurrentlyAttachedDevices().wait();
					let devices = this.getDeviceInstances();
					let platforms = _(devices)
						.map(device => device.deviceInfo.platform)
						.filter(pl => {
							try {
								return this.getPlatform(pl);
							} catch (err) {
								this.$logger.warn(err.message);
								return null;
							}
						})
						.uniq()
						.value();

					if (platforms.length === 1) {
						this._platform = platforms[0];
					} else if (platforms.length === 0) {
						this.$errors.fail({ formatStr: constants.ERROR_NO_DEVICES, suppressCommandHelp: true });
					} else {
						this.$errors.fail("Multiple device platforms detected (%s). Specify platform or device on command line.",
							helpers.formatListOfNames(platforms, "and"));
					}
				}
			}

			if (!this.$hostInfo.isDarwin && this._platform && this.$mobileHelper.isiOSPlatform(this._platform) && this.$options.emulator) {
				this.$errors.failWithoutHelp("You can use iOS simulator only on OS X.");
			}
			this._isInitialized = true;
		}).future<void>()();
	}

	public get hasDevices(): boolean {
		if (!this._platform) {
			return this.getDeviceInstances().length !== 0;
		} else {
			return this.filterDevicesByPlatform().length !== 0;
		}
	}

	public isOnlyiOSSimultorRunning(): boolean {
		let devices = this.getDeviceInstances();
		return this._platform && this.$mobileHelper.isiOSPlatform(this._platform) && _.find(devices, d => d.isEmulator) && !_.find(devices, d => !d.isEmulator);
	}

	public getDeviceByDeviceOption(): Mobile.IDevice {
		return this._device;
	}

	@exportedPromise("devicesService")
	public mapAbstractToTcpPort(deviceIdentifier: string, appIdentifier: string, framework: string): IFuture<string> {
		return this.$androidProcessService.mapAbstractToTcpPort(deviceIdentifier, appIdentifier, framework);
	}

	@exportedPromise("devicesService")
	public getDebuggableApps(deviceIdentifiers: string[]): IFuture<Mobile.IDeviceApplicationInformation[]>[] {
		return _.map(deviceIdentifiers, (deviceIdentifier: string) => this.getDebuggableAppsCore(deviceIdentifier));
	}

	@exportedPromise("devicesService")
	public async getDebuggableViews(deviceIdentifier: string, appIdentifier: string): Promise<Mobile.IDebugWebViewInfo[]> {
			let device = this.getDeviceByIdentifier(deviceIdentifier),
				debuggableViewsPerApp = device.applicationManager.getDebuggableAppViews([appIdentifier]).wait();

			return debuggableViewsPerApp && debuggableViewsPerApp[appIdentifier];
	}

	private clearDeviceDetectionInterval(): void {
		if (this.deviceDetectionInterval) {
			clearInterval(this.deviceDetectionInterval);
		} else {
			this.$logger.trace("Device detection interval is not started, so it cannot be stopped.");
		}
	}

	private async getDebuggableAppsCore(deviceIdentifier: string): Promise<Mobile.IDeviceApplicationInformation[]> {
			let device = this.getDeviceByIdentifier(deviceIdentifier);
			return device.applicationManager.getDebuggableApps().wait();
	}

	private async deployOnDevice(deviceIdentifier: string, packageFile: string, packageName: string, framework: string): Promise<void> {
			this.stopDeviceDetectionInterval().wait();
			let device = this.getDeviceByIdentifier(deviceIdentifier);
			device.applicationManager.reinstallApplication(packageName, packageFile).wait();
			this.$logger.info(`Successfully deployed on device with identifier '${device.deviceInfo.identifier}'.`);
			device.applicationManager.tryStartApplication(packageName, framework).wait();
	}

	private hasDevice(identifier: string): boolean {
		return _.some(this.getDeviceInstances(), (device: Mobile.IDevice) => { return device.deviceInfo.identifier === identifier; });
	}

	private filterDevicesByPlatform(): Mobile.IDevice[] {
		return _.filter(this.getDeviceInstances(), (device: Mobile.IDevice) => {
			if (this.$options.emulator && !device.isEmulator) {
				return false;
			}
			if (this._platform) {
				return device.deviceInfo.platform === this._platform;
			}
			return true;
		});
	}

	private validateIndex(index: number): void {
		if (index < 0 || index > this.getDeviceInstances().length) {
			throw new Error(util.format(this.$messages.Devices.NotFoundDeviceByIndexErrorMessage, index, this.$staticConfig.CLIENT_NAME.toLowerCase()));
		}
	}

	private resolveEmulatorServices(platform?: string): Mobile.IEmulatorPlatformServices {
		platform = platform || this._platform;
		if (this.$mobileHelper.isiOSPlatform(platform) && this.$hostInfo.isDarwin) {
			return this.$injector.resolve("iOSEmulatorServices");
		} else if (this.$mobileHelper.isAndroidPlatform(platform)) {
			return this.$injector.resolve("androidEmulatorServices");
		}

		return null;
	}

	public async startEmulator(platform?: string): Promise<void> {

			platform = platform || this._platform;

			let emulatorServices = this.resolveEmulatorServices(platform);
			if (!emulatorServices) {
				this.$errors.failWithoutHelp("Unable to detect platform for which to start emulator.");
			}
			emulatorServices.startEmulator().wait();

			if (this.$mobileHelper.isAndroidPlatform(platform)) {
				this.$androidDeviceDiscovery.startLookingForDevices().wait();
			} else if (this.$mobileHelper.isiOSPlatform(platform) && this.$hostInfo.isDarwin) {
				this.$iOSSimulatorDiscovery.startLookingForDevices().wait();
			}
	}

	private executeCore(action: (device: Mobile.IDevice) => IFuture<void>, canExecute?: (dev: Mobile.IDevice) => boolean): IFuture<void> {
		if (this._device) {
			return this.executeOnDevice(action, canExecute);
		}

		return this.executeOnAllConnectedDevices(action, canExecute);
	}

	private async isApplicationInstalledOnDevice(deviceIdentifier: string, appIdentifier: string, framework: string): Promise<IAppInstalledInfo> {
			let isInstalled = false,
				isLiveSyncSupported = false,
				device = this.getDeviceByIdentifier(deviceIdentifier);
			try {
				isInstalled = device.applicationManager.isApplicationInstalled(appIdentifier).wait();
				device.applicationManager.tryStartApplication(appIdentifier, framework).wait();
				isLiveSyncSupported = isInstalled && !!device.applicationManager.isLiveSyncSupported(appIdentifier).wait();
			} catch (err) {
				this.$logger.trace("Error while checking is application installed. Error is: ", err);
			}

			return {
				appIdentifier,
				deviceIdentifier,
				isInstalled,
				isLiveSyncSupported
			};
	}

	private async isCompanionAppInstalledOnDevice(deviceIdentifier: string, framework: string): Promise<IAppInstalledInfo> {
			let isInstalled = false,
				isLiveSyncSupported = false,
				device = this.getDeviceByIdentifier(deviceIdentifier),
				appIdentifier = this.$companionAppsService.getCompanionAppIdentifier(framework, device.deviceInfo.platform);

			try {
				isLiveSyncSupported = isInstalled = device.applicationManager.isApplicationInstalled(appIdentifier).wait();
			} catch (err) {
				this.$logger.trace("Error while checking is application installed. Error is: ", err);
			}

			return {
				appIdentifier,
				deviceIdentifier,
				isInstalled,
				isLiveSyncSupported
			};
	}

	private getDeviceDetectionIntervalFuture(): IFuture<void> {
		return this.deviceDetectionIntervalFuture || Future.fromResult();
	}
}

$injector.register("devicesService", DevicesService);
