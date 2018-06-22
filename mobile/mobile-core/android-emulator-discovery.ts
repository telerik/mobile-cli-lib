import { EventEmitter } from "events";
import { EmulatorDiscoveryNames } from "../../constants";

export class AndroidEmulatorDiscovery extends EventEmitter implements Mobile.IDeviceDiscovery {
	private _emulators: Mobile.IDeviceInfo[] = [];

	constructor(private $androidEmulatorServices: Mobile.IEmulatorPlatformService,
		private $mobileHelper: Mobile.IMobileHelper) { super(); }

	public async startLookingForDevices(options?: Mobile.IDeviceLookingOptions): Promise<void> {
		if (options && options.platform && !this.$mobileHelper.isAndroidPlatform(options.platform)) {
			return;
		}

		const availableEmulatorsOutput = await this.$androidEmulatorServices.getAvailableEmulators();
		const availableEmulators = availableEmulatorsOutput.devices;

		// Raise emulator found event for all new emulators
		for (const emulator of availableEmulators) {
			if (!_.includes(this._emulators, emulator)) {
				this.raiseOnEmulatorFound(emulator);
			}
		}

		// Raise emulator lost event for all deleted emulators
		for (const emulator of this._emulators) {
			if (!_.includes(availableEmulators, emulator)) {
				this.raiseOnEmulatorLost(emulator);
			}
		}
	}

	public checkForDevices(): Promise<void> {
		return;
	}

	private raiseOnEmulatorFound(emulator: Mobile.IDeviceInfo) {
		this.emit(EmulatorDiscoveryNames.AVAILABLE_EMULATOR_FOUND, emulator);
	}

	private raiseOnEmulatorLost(emulator: Mobile.IDeviceInfo) {
		this.emit(EmulatorDiscoveryNames.AVAILABLE_EMULATOR_LOST, emulator);
	}
}
$injector.register("androidEmulatorDiscovery", AndroidEmulatorDiscovery);
