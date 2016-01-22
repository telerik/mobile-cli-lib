///<reference path="./../../.d.ts"/>
"use strict";

import * as util from "util";
import Future = require("fibers/future");
import * as helpers from "../../helpers";
import * as assert from "assert";
import * as constants from "../constants";
import {exportedPromise, exported} from "../../decorators";
import * as fiberBootstrap from "../../fiber-bootstrap";

export class DevicesService implements Mobile.IDevicesService {
	private _devices: IDictionary<Mobile.IDevice> = {};
	private platforms: string[] = [];
	private static DEVICE_LOOKING_INTERVAL = 2200;
	private _platform: string;
	private _device: Mobile.IDevice;
	private _isInitialized = false;
	private _data: Mobile.IDevicesServicesInitializationOptions;

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
		private $options: ICommonOptions) {
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
	public isAppInstalledOnDevices(deviceIdentifiers: string[], appIdentifier: string): IFuture<boolean>[] {
		this.$logger.trace(`Called isInstalledOnDevices for identifiers ${deviceIdentifiers}. AppIdentifier is ${appIdentifier}.`);
		return _.map(deviceIdentifiers, deviceIdentifier => this.isApplicationInstalledOnDevice(deviceIdentifier, appIdentifier));
	}

	public getDeviceInstances(): Mobile.IDevice[] {
		return _.values(this._devices);
	}

	private getAllPlatforms(): Array<string> {
		if(this.platforms.length > 0) {
			return this.platforms;
		}

		this.platforms = _.filter(this.$mobileHelper.platformNames, platform => this.$mobileHelper.getPlatformCapabilities(platform).cableDeploy);
		return this.platforms;
	}

	private getPlatform(platform: string): string {
		let allSupportedPlatforms = this.getAllPlatforms();
		let normalizedPlatform = this.$mobileHelper.validatePlatformName(platform);
		if(!_.contains(allSupportedPlatforms, normalizedPlatform)) {
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

	private startLookingForDevices(): IFuture<void> {
		return (() => {
			this.$logger.trace("startLookingForDevices; platform is %s", this._platform);
			if(!this._platform) {
				try {
					this.$iOSDeviceDiscovery.startLookingForDevices().wait();
					this.$androidDeviceDiscovery.startLookingForDevices().wait();
					if (this.$hostInfo.isDarwin) {
						this.$iOSSimulatorDiscovery.startLookingForDevices().wait();
					}
				} catch (err) {
					this.$logger.trace("Error while detecting devices.", err);
				}
				setInterval(() => {
					fiberBootstrap.run(() => {
						try {
							// This code could be faster, by using Future.wait([...]), but it turned out this is breaking iOS deployment on Mac
							// It's causing error 21 when deploying on some iOS devices during transfer of the first package.
							this.$iOSDeviceDiscovery.checkForDevices().wait();
							this.$androidDeviceDiscovery.checkForDevices().wait();
							if (this.$hostInfo.isDarwin) {
								this.$iOSSimulatorDiscovery.checkForDevices().wait();
							}
						} catch (err) {
							this.$logger.trace("Error while checking for new devices.", err);
						}
					});
				}, DevicesService.DEVICE_LOOKING_INTERVAL).unref();
			} else if(this.$mobileHelper.isiOSPlatform(this._platform)) {
				this.$iOSDeviceDiscovery.startLookingForDevices().wait();
				if (this.$hostInfo.isDarwin) {
					this.$iOSSimulatorDiscovery.startLookingForDevices().wait();
				}
			} else if(this.$mobileHelper.isAndroidPlatform(this._platform)) {
				this.$androidDeviceDiscovery.startLookingForDevices().wait();
			}
		}).future<void>()();
	}

	private getAllConnectedDevices(): Mobile.IDevice[] {
		if(!this._platform) {
			return this.getDeviceInstances();
		} else {
			return this.filterDevicesByPlatform();
		}
	}

	private getDeviceByIndex(index: number): Mobile.IDevice {
		this.validateIndex(index-1);
		return this.getDeviceInstances()[index-1];
	}

	private getDeviceByIdentifier(identifier: string): Mobile.IDevice {
		let searchedDevice = _.find(this.getDeviceInstances(), (device: Mobile.IDevice) => { return device.deviceInfo.identifier === identifier; });
		if(!searchedDevice) {
			this.$errors.fail(this.$messages.Devices.NotFoundDeviceByIdentifierErrorMessageWithIdentifier, identifier, this.$staticConfig.CLIENT_NAME.toLowerCase());
		}

		return searchedDevice;
	}

	private getDevice(deviceOption: string): IFuture<Mobile.IDevice> {
		return (() => {
			this.startLookingForDevices().wait();
			let device: Mobile.IDevice = null;

			if(this.hasDevice(deviceOption)) {
				device = this.getDeviceByIdentifier(deviceOption);
			} else if(helpers.isNumber(deviceOption)) {
				device = this.getDeviceByIndex(parseInt(deviceOption, 10));
			}

			if(!device) {
				this.$errors.fail(this.$messages.Devices.NotFoundDeviceByIdentifierErrorMessage, this.$staticConfig.CLIENT_NAME.toLowerCase());
			}

			return device;
		}).future<Mobile.IDevice>()();
	}

	private executeOnDevice(action: (dev: Mobile.IDevice) => IFuture<void>, canExecute?: (_dev: Mobile.IDevice) => boolean): IFuture<void> {
		return ((): void => {
			if(!canExecute || canExecute(this._device)) {
				action(this._device).wait();
			}
		}).future<void>()();
	}

	private executeOnAllConnectedDevices(action: (dev: Mobile.IDevice) => IFuture<void>, canExecute?: (_dev: Mobile.IDevice) => boolean): IFuture<void> {
		return ((): void => {
			let devices = this.getAllConnectedDevices();
			let sortedDevices = _.sortBy(devices, device => device.deviceInfo.platform);

			let futures = _.map(sortedDevices, (device: Mobile.IDevice) => {
				if (!canExecute || canExecute(device)) {
					return action(device);
				} else {
					return Future.fromResult();
				}
			});

			Future.wait(futures);
		}).future<void>()();
	}

	@exportedPromise("devicesService")
	public deployOnDevices(deviceIdentifiers: string[], packageFile: string, packageName: string): IFuture<void>[] {
		this.$logger.trace(`Called deployOnDevices for identifiers ${deviceIdentifiers} for packageFile: ${packageFile}. packageName is ${packageName}.`);
		return _.map(deviceIdentifiers, deviceIdentifier => this.deployOnDevice(deviceIdentifier, packageFile, packageName));
	}

	public execute(action: (device: Mobile.IDevice) => IFuture<void>, canExecute?: (dev: Mobile.IDevice) => boolean, options?: {allowNoDevices?: boolean}): IFuture<void> {
		return ((): void => {
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
		}).future<void>()();
	}

	public initialize(data?: Mobile.IDevicesServicesInitializationOptions): IFuture<void> {
		if (this._isInitialized) {
			return Future.fromResult();
		}
		return(() => {
			data = data || {};
			this._data = data;
			let platform =  data.platform;
			let deviceOption = data.deviceId;

			if(platform && deviceOption) {
				this._device = this.getDevice(deviceOption).wait();
				this._platform = this._device.deviceInfo.platform;
				if(this._platform !== this.getPlatform(platform)) {
					this.$errors.fail("Cannot resolve the specified connected device. The provided platform does not match the provided index or identifier." +
						"To list currently connected devices and verify that the specified pair of platform and index or identifier exists, run 'device'.");
				}
				this.$logger.warn("Your application will be deployed only on the device specified by the provided index or identifier.");
			} else if(!platform && deviceOption) {
				this._device = this.getDevice(deviceOption).wait();
				this._platform = this._device.deviceInfo.platform;
			} else if(platform && !deviceOption) {
				this._platform = this.getPlatform(platform);
				this.startLookingForDevices().wait();
			} else {
				// platform and deviceId are not specified
				this.startLookingForDevices().wait();
				if (!data.skipInferPlatform) {
					let devices = this.getDeviceInstances();
					let platforms = _(devices)
									.map(device => device.deviceInfo.platform)
									.filter(pl => {
										try {
											return this.getPlatform(pl);
										} catch(err) {
											this.$logger.warn(err.message);
											return null;
										}
									})
									.uniq()
									.value();

					if (platforms.length === 1) {
						this._platform = platforms[0];
					} else if (platforms.length === 0) {
						this.$errors.fail({formatStr: constants.ERROR_NO_DEVICES, suppressCommandHelp: true});
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

	private deployOnDevice(deviceIdentifier: string, packageFile: string, packageName: string): IFuture<void> {
		return (() => {
			let device = this.getDeviceByIdentifier(deviceIdentifier);
			device.applicationManager.reinstallApplication(packageName, packageFile).wait();
			this.$logger.info(`Successfully deployed on device with identifier '${device.deviceInfo.identifier}'.`);
			if (device.applicationManager.canStartApplication()) {
				try {
					device.applicationManager.startApplication(packageName).wait();
				} catch(err) {
					this.$logger.trace("Unable to start application on device. Error is: ", err);
				}
			}
		}).future<void>()();
	}

	private hasDevice(identifier: string): boolean {
		return _.some(this.getDeviceInstances(), (device: Mobile.IDevice) => { return device.deviceInfo.identifier === identifier; });
	}

	private filterDevicesByPlatform(): Mobile.IDevice[] {
		return _.filter(this.getDeviceInstances(), (device: Mobile.IDevice) => { return device.deviceInfo.platform === this._platform; });
	}

	private validateIndex(index: number): void {
		if (index < 0 || index > this.getDeviceInstances().length) {
			throw new Error(util.format(this.$messages.Devices.NotFoundDeviceByIndexErrorMessage, index, this.$staticConfig.CLIENT_NAME.toLowerCase()));
		}
	}

	private resolveEmulatorServices(): Mobile.IEmulatorPlatformServices {
		if (this.$mobileHelper.isiOSPlatform(this._platform) && this.$hostInfo.isDarwin) {
			return this.$injector.resolve("iOSEmulatorServices");
		} else if (this.$mobileHelper.isAndroidPlatform(this._platform)) {
			return this.$injector.resolve("androidEmulatorServices");
		}

		return null;
	}

	private startEmulator(): IFuture<void> {
		return (() => {
			let emulatorServices = this.resolveEmulatorServices();
			if(!emulatorServices) {
				this.$errors.failWithoutHelp("Unable to detect platform for which to start emulator.");
			}
			emulatorServices.startEmulator().wait();
			if (this.$mobileHelper.isAndroidPlatform(this._platform)) {
				this.$androidDeviceDiscovery.checkForDevices().wait();
			} else if (this.$mobileHelper.isiOSPlatform(this._platform) && this.$hostInfo.isDarwin) {
				this.$iOSSimulatorDiscovery.checkForDevices().wait();
			}
		}).future<void>()();
	}

	private executeCore(action: (device: Mobile.IDevice) => IFuture<void>, canExecute?: (dev: Mobile.IDevice) => boolean): IFuture<void> {
		if (this._device) {
			return this.executeOnDevice(action, canExecute);
		}

		return this.executeOnAllConnectedDevices(action, canExecute);
}

	private isApplicationInstalledOnDevice(deviceIdentifier: string, appIdentifier: string): IFuture<boolean> {
		return ((): boolean => {
			let device = this.getDeviceByIdentifier(deviceIdentifier);
			return device.applicationManager.isApplicationInstalled(appIdentifier).wait();
		}).future<boolean>()();
	}
}

$injector.register("devicesService", DevicesService);
