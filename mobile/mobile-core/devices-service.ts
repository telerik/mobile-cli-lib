import * as util from "util";
import * as helpers from "../../helpers";
import * as assert from "assert";
import * as constants from "../../constants";
import { exported } from "../../decorators";
import { settlePromises } from "../../helpers";
import { EventEmitter } from "events";
import { EOL } from "os";

export class DevicesService extends EventEmitter implements Mobile.IDevicesService {
	private static DEVICE_LOOKING_INTERVAL = 200;
	private _devices: IDictionary<Mobile.IDevice> = {};
	private platforms: string[] = [];
	private _platform: string;
	private _device: Mobile.IDevice;
	private _isInitialized = false;
	private _data: Mobile.IDevicesServicesInitializationOptions;
	private _otherDeviceDiscoveries: Mobile.IDeviceDiscovery[] = [];
	private _allDeviceDiscoveries: Mobile.IDeviceDiscovery[] = [];
	private deviceDetectionInterval: any;
	private isDeviceDetectionIntervalInProgress: boolean;

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
		private $injector: IInjector,
		private $options: ICommonOptions,
		private $androidProcessService: Mobile.IAndroidProcessService,
		private $processService: IProcessService) {
		super();
		this.attachToKnownDeviceDiscoveryEvents();
		this._allDeviceDiscoveries = [this.$iOSDeviceDiscovery, this.$androidDeviceDiscovery, this.$iOSSimulatorDiscovery];
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

	@exported("devicesService")
	public isAppInstalledOnDevices(deviceIdentifiers: string[], appIdentifier: string): Promise<IAppInstalledInfo>[] {
		this.$logger.trace(`Called isInstalledOnDevices for identifiers ${deviceIdentifiers}. AppIdentifier is ${appIdentifier}.`);
		return _.map(deviceIdentifiers, deviceIdentifier => this.isApplicationInstalledOnDevice(deviceIdentifier, appIdentifier));
	}

	@exported("devicesService")
	public isCompanionAppInstalledOnDevices(deviceIdentifiers: string[], framework: string): Promise<IAppInstalledInfo>[] {
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

	@exported("devicesService")
	public addDeviceDiscovery(deviceDiscovery: Mobile.IDeviceDiscovery): void {
		this._otherDeviceDiscoveries.push(deviceDiscovery);
		this._allDeviceDiscoveries.push(deviceDiscovery);
		this.attachToDeviceDiscoveryEvents(deviceDiscovery);
	}

	private attachToKnownDeviceDiscoveryEvents(): void {
		[this.$iOSSimulatorDiscovery, this.$iOSDeviceDiscovery, this.$androidDeviceDiscovery].forEach(this.attachToDeviceDiscoveryEvents.bind(this));
	}

	private attachToDeviceDiscoveryEvents(deviceDiscovery: Mobile.IDeviceDiscovery): void {
		deviceDiscovery.on(constants.DeviceDiscoveryEventNames.DEVICE_FOUND, (device: Mobile.IDevice) => this.onDeviceFound(device));
		deviceDiscovery.on(constants.DeviceDiscoveryEventNames.DEVICE_LOST, (device: Mobile.IDevice) => this.onDeviceLost(device));
	}

	private onDeviceFound(device: Mobile.IDevice): void {
		this.$logger.trace(`Found device with identifier '${device.deviceInfo.identifier}'`);
		this._devices[device.deviceInfo.identifier] = device;
		this.emit(constants.DeviceDiscoveryEventNames.DEVICE_FOUND, device);
	}

	private onDeviceLost(device: Mobile.IDevice): void {
		this.$logger.trace(`Lost device with identifier '${device.deviceInfo.identifier}'`);
		delete this._devices[device.deviceInfo.identifier];
		this.emit(constants.DeviceDiscoveryEventNames.DEVICE_LOST, device);
	}

	/**
	 * Starts looking for devices. Any found devices are pushed to "_devices" variable.
	 */
	public async detectCurrentlyAttachedDevices(options?: Mobile.IDeviceLookingOptions): Promise<void> {
		for (const deviceDiscovery of this._allDeviceDiscoveries) {
			try {
				await deviceDiscovery.startLookingForDevices(options);
			} catch (err) {
				this.$logger.trace("Error while checking for devices.", err);
			}
		}
	}

	public async startDeviceDetectionInterval(): Promise<void> {
		this.$processService.attachToProcessExitSignals(this, this.clearDeviceDetectionInterval);

		if (this.deviceDetectionInterval) {
			this.$logger.trace("Device detection interval is already started. New Interval will not be started.");
		} else {
			let isFirstExecution = true;

			return new Promise<void>((resolve, reject) => {
				this.deviceDetectionInterval = setInterval(async () => {
					if (this.isDeviceDetectionIntervalInProgress) {
						return;
					}

					this.isDeviceDetectionIntervalInProgress = true;

					for (const deviceDiscovery of this._allDeviceDiscoveries) {
						try {
							await deviceDiscovery.startLookingForDevices();
						} catch (err) {
							this.$logger.trace("Error while checking for new devices.", err);
						}
					}

					try {
						const trustedDevices = _.filter(this._devices, device => device.deviceInfo.status === constants.CONNECTED_STATUS);
						await settlePromises(_.map(trustedDevices, device => device.applicationManager.checkForApplicationUpdates()));
					} catch (err) {
						this.$logger.trace("Error checking for application updates on devices.", err);
					}

					if (isFirstExecution) {
						isFirstExecution = false;
						resolve();
						this.deviceDetectionInterval.unref();
					}

					this.isDeviceDetectionIntervalInProgress = false;

				}, DevicesService.DEVICE_LOOKING_INTERVAL);
			});
		}
	}

	/**
	 * Returns device that matches an identifier.
	 * The identifier is expected to be the same as the running device declares it (emulator-5554 for android or GUID for ios).
	 * @param identifier running emulator or device identifier
	 */
	public getDeviceByIdentifier(identifier: string): Mobile.IDevice {
		let searchedDevice = _.find(this.getDeviceInstances(), (device: Mobile.IDevice) => { return device.deviceInfo.identifier === identifier; });
		if (!searchedDevice) {
			this.$errors.fail(this.$messages.Devices.NotFoundDeviceByIdentifierErrorMessageWithIdentifier, identifier, this.$staticConfig.CLIENT_NAME.toLowerCase());
		}

		return searchedDevice;
	}

	/**
	 * Starts looking for running devices. All found devices are pushed to _devices variable.
	 */
	private async startLookingForDevices(options?: Mobile.IDeviceLookingOptions): Promise<void> {
		this.$logger.trace("startLookingForDevices; platform is %s", this._platform);
		if (!this._platform) {
			await this.detectCurrentlyAttachedDevices(options);
			await this.startDeviceDetectionInterval();
		} else {
			if (this.$mobileHelper.isiOSPlatform(this._platform)) {
				await this.$iOSDeviceDiscovery.startLookingForDevices();
				await this.$iOSSimulatorDiscovery.startLookingForDevices();
			} else if (this.$mobileHelper.isAndroidPlatform(this._platform)) {
				await this.$androidDeviceDiscovery.startLookingForDevices();
			}

			for (const deviceDiscovery of this._otherDeviceDiscoveries) {
				try {
					await deviceDiscovery.startLookingForDevices(options);
				} catch (err) {
					this.$logger.trace("Error while checking for new devices.", err);
				}
			}
		}
	}

	/**
	 * Returns device depending on the passed index.
	 * The index refers to assigned number to listed devices by tns device command.
	 * @param index assigned device number
	 */
	private getDeviceByIndex(index: number): Mobile.IDevice {
		this.validateIndex(index - 1);
		return this.getDeviceInstances()[index - 1];
	}

	/**
	 * Returns running device for specified --device <DeviceId>.
	 * Method expects running devices.
	 * @param identifier parameter passed by the user to --device flag
	 */
	private async getDevice(deviceOption: string): Promise<Mobile.IDevice> {
		await this.detectCurrentlyAttachedDevices();
		let device: Mobile.IDevice = null;

		let emulatorIdentifier = null;
		if (this._platform) {
			let emulatorService = this.resolveEmulatorServices();
			emulatorIdentifier = await emulatorService.getRunningEmulatorId(deviceOption);
		}

		if (this.hasRunningDevice(emulatorIdentifier)) {
			device = this.getDeviceByIdentifier(emulatorIdentifier);
		} else if (helpers.isNumber(deviceOption)) {
			device = this.getDeviceByIndex(parseInt(deviceOption, 10));
		} else {
			device = this.getDeviceByIdentifier(deviceOption);
		}

		if (!device) {
			this.$errors.fail(this.$messages.Devices.NotFoundDeviceByIdentifierErrorMessage, this.$staticConfig.CLIENT_NAME.toLowerCase());
		}

		return device;
	}

	/**
	 * Method runs action for a --device (value), specified by the user.
	 * @param action action to be executed if canExecute returns true
	 * @param canExecute predicate to decide whether the command can be ran
	 */
	private async executeOnDevice<T>(action: (dev: Mobile.IDevice) => Promise<T>, canExecute?: (_dev: Mobile.IDevice) => boolean): Promise<Mobile.IDeviceActionResult<T>[]> {
		if (!canExecute || canExecute(this._device)) {
			return [{ deviceIdentifier: this._device.deviceInfo.identifier, result: await action(this._device) }];
		}
	}

	/**
	 * Executes passed action for each found device.
	 * @param action action to be executed if canExecute returns true
	 * @param canExecute predicate to decide whether the command can be ran
	 */
	private async executeOnAllConnectedDevices<T>(action: (dev: Mobile.IDevice) => Promise<T>, canExecute?: (_dev: Mobile.IDevice) => boolean): Promise<Mobile.IDeviceActionResult<T>[]> {
		let devices = this.filterDevicesByPlatform();
		let sortedDevices = _.sortBy(devices, device => device.deviceInfo.platform);
		const result: Mobile.IDeviceActionResult<T>[] = [];

		let errors: Error[] = [];
		for (let device of sortedDevices) {
			try {
				if (!canExecute || canExecute(device)) {
					result.push({ deviceIdentifier: device.deviceInfo.identifier, result: await action(device) });
				}
			} catch (err) {
				errors.push(err);
			}
		}

		if (errors.length) {
			throw new Error(`Multiple errors were thrown:${EOL}${errors.map(e => e.message || e).join(EOL)}`);
		}

		return result;
	}

	@exported("devicesService")
	public deployOnDevices(deviceIdentifiers: string[], packageFile: string, packageName: string): Promise<void>[] {
		this.$logger.trace(`Called deployOnDevices for identifiers ${deviceIdentifiers} for packageFile: ${packageFile}. packageName is ${packageName}.`);
		return _.map(deviceIdentifiers, deviceIdentifier => this.deployOnDevice(deviceIdentifier, packageFile, packageName));
	}

	/**
	 * Runs the passed action if the predicate "canExecute" returns true
	 * @param action action to be executed if canExecute returns true.
	 * @param canExecute predicate to decide whether the command can be ran
	 * @param options all possible options that can be passed to the command.
	 */
	public async execute<T>(action: (device: Mobile.IDevice) => Promise<T>, canExecute?: (dev: Mobile.IDevice) => boolean, options?: { allowNoDevices?: boolean }): Promise<Mobile.IDeviceActionResult<T>[]> {
		assert.ok(this._isInitialized, "Devices services not initialized!");

		if (this.hasDevices) {
			if (this.$hostInfo.isDarwin && this._platform
				&& this.$mobileHelper.isiOSPlatform(this._platform)
				&& this.$options.emulator && !this.isOnlyiOSSimultorRunning()) {
				// Executes the command only on iOS simulator
				let originalCanExecute = canExecute;
				canExecute = (dev: Mobile.IDevice): boolean => this.isiOSSimulator(dev) && (!originalCanExecute || !!(originalCanExecute(dev)));
			}

			return await this.executeCore(action, canExecute);
		} else {
			let message = constants.ERROR_NO_DEVICES;
			if (options && options.allowNoDevices) {
				this.$logger.info(message);
			} else {
				if (!this.$hostInfo.isDarwin && this._platform && this.$mobileHelper.isiOSPlatform(this._platform)) {
					this.$errors.failWithoutHelp(message);
				} else {
					return await this.executeCore(action, canExecute);
				}
			}
		}
	}

	/**
	 * Starts emulator or simulator if necessary depending on --device or --emulator flags.
	 * If no options are passed runs default emulator/simulator if no devices are connected.
	 * @param data mainly contains information about --emulator and --deviceId flags.
	 */
	public async startEmulatorIfNecessary(data?: Mobile.IDevicesServicesInitializationOptions): Promise<void> {
		if (data && data.deviceId && data.emulator) {
			this.$errors.failWithoutHelp(`--device and --emulator are incompatible options.
			If you are trying to run on specific emulator, use "${this.$staticConfig.CLIENT_NAME} run --device <DeviceID>`);
		}

		if (data && data.platform && !data.skipInferPlatform) {
			// are there any running devices
			this._platform = data.platform;
			try {
				await this.startLookingForDevices();
			} catch (err) {
				this.$logger.trace("Error while checking for devices.", err);
			}
			let deviceInstances = this.getDeviceInstances();

			//if no --device is passed and no devices are found, the default emulator is started
			if (!data.deviceId && _.isEmpty(deviceInstances)) {
				if (!this.$hostInfo.isDarwin && this.$mobileHelper.isiOSPlatform(data.platform)) {
					this.$errors.failWithoutHelp(constants.ERROR_NO_DEVICES_CANT_USE_IOS_SIMULATOR);
				}

				return await this.startEmulator(data.platform);
			}

			//check if --device(value) is running, if it's not or it's not the same as is specified, start with name from --device(value)
			if (data.deviceId) {
				if (!helpers.isNumber(data.deviceId)) {
					let activeDeviceInstance = _.find(this.getDeviceInstances(), (device: Mobile.IDevice) => { return device.deviceInfo.identifier === data.deviceId; });
					if (!activeDeviceInstance) {
						return await this.startEmulator(data.platform, data.deviceId);
					}
				}
			}

			// if only emulator flag is passed and no other emulators are running, start default emulator
			if (data.emulator && deviceInstances.length) {
				let runningDeviceInstance = _.some(deviceInstances, (value) => value.isEmulator);
				if (!runningDeviceInstance) {
					return await this.startEmulator(data.platform);
				}
			}
		}
	}

	/**
	 * Takes care of gathering information about all running devices.
	 * Sets "_isInitialized" to true after infomation is present.
	 * Method expects running devices.
	 * @param data mainly contains information about --emulator and --deviceId flags.
	 */
	@exported("devicesService")
	public async initialize(data?: Mobile.IDevicesServicesInitializationOptions): Promise<void> {
		if (this._isInitialized) {
			return;
		}

		this.$logger.out("Searching for devices...");

		data = data || {};

		if (!data.isBuildForDevice) {
			await this.startEmulatorIfNecessary(data);
		}

		this._data = data;
		let platform = data.platform;
		let deviceOption = data.deviceId;

		if (platform && deviceOption) {
			this._platform = this.getPlatform(data.platform);
			this._device = await this.getDevice(deviceOption);
			if (this._device.deviceInfo.platform !== this._platform) {
				this.$errors.fail(constants.ERROR_CANNOT_RESOLVE_DEVICE);
			}
			this.$logger.warn("Your application will be deployed only on the device specified by the provided index or identifier.");
		} else if (!platform && deviceOption) {
			this._device = await this.getDevice(deviceOption);
			this._platform = this._device.deviceInfo.platform;
		} else if (platform && !deviceOption) {
			this._platform = this.getPlatform(platform);
			await this.startLookingForDevices();
		} else {
			// platform and deviceId are not specified
			if (data.skipInferPlatform) {
				if (data.skipDeviceDetectionInterval) {
					await this.detectCurrentlyAttachedDevices();
				} else {
					await this.startLookingForDevices({ shouldReturnImmediateResult: true, platform: this._platform });
				}
			} else {
				await this.detectCurrentlyAttachedDevices();

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
			this.$errors.failWithoutHelp(constants.ERROR_CANT_USE_SIMULATOR);
		}
		this._isInitialized = true;
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

	@exported("devicesService")
	public async mapAbstractToTcpPort(deviceIdentifier: string, appIdentifier: string, framework: string): Promise<string> {
		return this.$androidProcessService.mapAbstractToTcpPort(deviceIdentifier, appIdentifier, framework);
	}

	@exported("devicesService")
	public getDebuggableApps(deviceIdentifiers: string[]): Promise<Mobile.IDeviceApplicationInformation[]>[] {
		return _.map(deviceIdentifiers, (deviceIdentifier: string) => this.getDebuggableAppsCore(deviceIdentifier));
	}

	@exported("devicesService")
	public async getDebuggableViews(deviceIdentifier: string, appIdentifier: string): Promise<Mobile.IDebugWebViewInfo[]> {
		let device = this.getDeviceByIdentifier(deviceIdentifier),
			debuggableViewsPerApp = await device.applicationManager.getDebuggableAppViews([appIdentifier]);

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
		return await device.applicationManager.getDebuggableApps();
	}

	private async deployOnDevice(deviceIdentifier: string, packageFile: string, packageName: string): Promise<void> {
		let device = this.getDeviceByIdentifier(deviceIdentifier);
		await device.applicationManager.reinstallApplication(packageName, packageFile);
		this.$logger.info(`Successfully deployed on device with identifier '${device.deviceInfo.identifier}'.`);
		await device.applicationManager.tryStartApplication(packageName);
	}

	/**
	 * Returns true if there's a running device with specified identifier.
	 * @param identifier parameter passed by the user to --device flag
	 */
	private hasRunningDevice(identifier: string): boolean {
		return _.some(this.getDeviceInstances(), (device: Mobile.IDevice) => {
			return device.deviceInfo.identifier === identifier;
		});
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
		if (this.$mobileHelper.isiOSPlatform(platform)) {
			return this.$injector.resolve("iOSEmulatorServices");
		} else if (this.$mobileHelper.isAndroidPlatform(platform)) {
			return this.$injector.resolve("androidEmulatorServices");
		}

		return null;
	}

	/**
	 * Starts emulator for platform and makes sure started devices/emulators/simulators are in _devices array before finishing.
	 * @param platform (optional) platform to start emulator/simulator for
	 * @param emulatorImage (optional) emulator/simulator image identifier
	 */
	public async startEmulator(platform?: string, emulatorImage?: string): Promise<void> {

		platform = platform || this._platform;

		let emulatorServices = this.resolveEmulatorServices(platform);
		if (!emulatorServices) {
			this.$errors.failWithoutHelp("Unable to detect platform for which to start emulator.");
		}

		await emulatorServices.startEmulator(emulatorImage);

		if (this.$mobileHelper.isAndroidPlatform(platform)) {
			await this.$androidDeviceDiscovery.startLookingForDevices();
		} else if (this.$mobileHelper.isiOSPlatform(platform) && this.$hostInfo.isDarwin) {
			await this.$iOSSimulatorDiscovery.startLookingForDevices();
		}
	}

	private async executeCore<T>(action: (device: Mobile.IDevice) => Promise<T>, canExecute?: (dev: Mobile.IDevice) => boolean): Promise<Mobile.IDeviceActionResult<T>[]> {
		if (this._device) {
			return this.executeOnDevice(action, canExecute);
		}

		return this.executeOnAllConnectedDevices(action, canExecute);
	}

	private async isApplicationInstalledOnDevice(deviceIdentifier: string, appIdentifier: string): Promise<IAppInstalledInfo> {
		let isInstalled = false,
			isLiveSyncSupported = false,
			device = this.getDeviceByIdentifier(deviceIdentifier);

		try {
			isInstalled = await device.applicationManager.isApplicationInstalled(appIdentifier);
			await device.applicationManager.tryStartApplication(appIdentifier);
			isLiveSyncSupported = await isInstalled && !!device.applicationManager.isLiveSyncSupported(appIdentifier);
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
			isLiveSyncSupported = isInstalled = await device.applicationManager.isApplicationInstalled(appIdentifier);
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
}

$injector.register("devicesService", DevicesService);
