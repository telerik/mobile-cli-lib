///<reference path="../../../.d.ts"/>
"use strict";
import util = require("util");
import Future = require("fibers/future");
import helpers = require("../../helpers");
let assert = require("assert");
import constants = require("../constants");

export class DevicesServices implements Mobile.IDevicesServices {
	private devices: IDictionary<Mobile.IDevice> = {};
	private platforms: string[] = [];
	private static NOT_FOUND_DEVICE_BY_IDENTIFIER_ERROR_MESSAGE = "Could not find device by specified identifier '%s'. To list currently connected devices and verify that the specified identifier exists, run '%s device'.";
	private static NOT_FOUND_DEVICE_BY_INDEX_ERROR_MESSAGE = "Could not find device by specified index %d. To list currently connected devices and verify that the specified index exists, run '%s device'.";
	private _platform: string;
	private _device: Mobile.IDevice;
	private _isInitialized = false;

	constructor(private $logger: ILogger,
		private $errors: IErrors,
		private $iOSDeviceDiscovery: Mobile.IDeviceDiscovery,
		private $androidDeviceDiscovery: Mobile.IDeviceDiscovery,
		private $staticConfig: Config.IStaticConfig,
		private $mobileHelper: Mobile.IMobileHelper) {
		this.attachToDeviceDiscoveryEvents();
	}

	public get platform(): string {
		return this._platform;
	}

	public get deviceCount(): number {
		return this._device ? 1 : this.getDevices().length;
	}

	private getDevices(): Mobile.IDevice[] {
		return _.values(this.devices);
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

	private attachToDeviceDiscoveryEvents() {
		this.$iOSDeviceDiscovery.on("deviceFound", (device: Mobile.IDevice) => this.onDeviceFound(device));
		this.$iOSDeviceDiscovery.on("deviceLost", (device: Mobile.IDevice) => this.onDeviceLost(device));

		this.$androidDeviceDiscovery.on("deviceFound", (device: Mobile.IDevice) => this.onDeviceFound(device));
		this.$androidDeviceDiscovery.on("deviceLost", (device: Mobile.IDevice) => this.onDeviceLost(device));
	}

	private onDeviceFound(device: Mobile.IDevice): void {
		this.$logger.trace("Found device with identifier '%s'", device.deviceInfo.identifier);
		this.devices[device.deviceInfo.identifier] = device;
	}

	private onDeviceLost(device: Mobile.IDevice): void {
		this.$logger.trace("Lost device with identifier '%s'", device.deviceInfo.identifier);
		delete this.devices[device.deviceInfo.identifier];
	}

	private startLookingForDevices(): IFuture<void> {
		return (() => {
			this.$logger.trace("startLookingForDevices; platform is %s", this._platform);
			if(!this._platform) {
				this.$iOSDeviceDiscovery.startLookingForDevices().wait();
				this.$androidDeviceDiscovery.startLookingForDevices().wait();
			} else if(this.$mobileHelper.isiOSPlatform(this._platform)) {
				this.$iOSDeviceDiscovery.startLookingForDevices().wait();
			} else if(this.$mobileHelper.isAndroidPlatform(this._platform)) {
				this.$androidDeviceDiscovery.startLookingForDevices().wait();
			}
		}).future<void>()();
	}

	private getAllConnectedDevices(): Mobile.IDevice[] {
		if(!this._platform) {
			return this.getDevices();
		} else {
			return this.filterDevicesByPlatform();
		}
	}

	private getDeviceByIndex(index: number): Mobile.IDevice {
		this.validateIndex(index-1);
		return this.getDevices()[index-1];
	}

	private getDeviceByIdentifier(identifier: string): Mobile.IDevice {
		let searchedDevice = _.find(this.getDevices(), (device: Mobile.IDevice) => { return device.deviceInfo.identifier === identifier; });
		if(!searchedDevice) {
			this.$errors.fail(DevicesServices.NOT_FOUND_DEVICE_BY_IDENTIFIER_ERROR_MESSAGE, identifier, this.$staticConfig.CLIENT_NAME.toLowerCase());
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
				this.$errors.fail("Cannot resolve the specified connected device by the provided index or identifier. To list currently connected devices and verify that the specified index or identifier exists, run '%s device'.", this.$staticConfig.CLIENT_NAME.toLowerCase());
			}

			return device;
		}).future<Mobile.IDevice>()();
	}

	private executeOnDevice(action: (dev: Mobile.IDevice) => IFuture<void>, canExecute?: (dev: Mobile.IDevice) => boolean): IFuture<void> {
		return ((): void => {
			if(!canExecute || canExecute(this._device)) {
				action(this._device).wait();
			}
		}).future<void>()();
	}

	private executeOnAllConnectedDevices(action: (dev: Mobile.IDevice) => IFuture<void>, canExecute?: (dev: Mobile.IDevice) => boolean): IFuture<void> {
		return ((): void => {
			let allConnectedDevices = this.getAllConnectedDevices();
			let futures = _.map(allConnectedDevices, (device: Mobile.IDevice) => {
				if (!canExecute || canExecute(device)) {
					let future = action(device);
					Future.settle(future);
					return future;
				} else {
					return Future.fromResult();
				}
			});

			Future.wait(futures); //SAFE: all futures settled serially by the above Future.settle call
		}).future<void>()();
	}

	public execute(action: (device: Mobile.IDevice) => IFuture<void>, canExecute?: (dev: Mobile.IDevice) => boolean, options?: {[key: string]: boolean}): IFuture<void> {
		return ((): void => {
			assert.ok(this._isInitialized, "Devices services not initialized!");
			if(this.hasDevices) {
				if(this._device) {
					this.executeOnDevice(action, canExecute).wait();
				} else {
					this.executeOnAllConnectedDevices(action, canExecute).wait();
				}
			} else {
				let message = constants.ERROR_NO_DEVICES;
				if(options && options["allowNoDevices"]) {
					this.$logger.info(message);
				} else {
					this.$errors.failWithoutHelp(message);
				}
			}
		}).future<void>()();
	}

	public initialize(data?: Mobile.IDevicesServicesInitializationOptions): IFuture<void> {
		let platform = data.platform;
		let deviceOption = data.deviceId;

		if (this._isInitialized) {
			return Future.fromResult();
		}
		return(() => {
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
			} else if(!platform && !deviceOption) {
				this.startLookingForDevices().wait();

				if (!data.skipInferPlatform) {
					let devices = this.getDevices();
					let platforms = _.uniq(_.map(devices, (device) => device.deviceInfo.platform));

					if (platforms.length === 1) {
						this._platform = platforms[0];
					} else {
						if (platforms.length === 0) {
							this.$errors.fail({formatStr: constants.ERROR_NO_DEVICES, suppressCommandHelp: true});
						} else {
							this.$errors.fail("Multiple device platforms detected (%s). Specify platform or device on command line.",
								helpers.formatListOfNames(platforms, "and"));
						}
					}
				}
			}
			this._isInitialized = true;
		}).future<void>()();
	}

	public get hasDevices(): boolean {
		if (!this._platform) {
			return this.getDevices().length !== 0;
		} else {
			return this.filterDevicesByPlatform().length !== 0;
		}
	}

	private hasDevice(identifier: string): boolean {
		return _.some(this.getDevices(), (device: Mobile.IDevice) => { return device.deviceInfo.identifier === identifier });
	}

	private filterDevicesByPlatform(): Mobile.IDevice[] {
		return _.filter(this.getDevices(), (device: Mobile.IDevice) => { return device.deviceInfo.platform === this._platform; });
	}

	private validateIndex(index: number): void {
		if (index < 0 || index > this.getDevices().length) {
			throw new Error(util.format(DevicesServices.NOT_FOUND_DEVICE_BY_INDEX_ERROR_MESSAGE, index, this.$staticConfig.CLIENT_NAME.toLowerCase()));
		}
	}
}

$injector.register("devicesServices", DevicesServices);
