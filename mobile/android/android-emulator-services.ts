import { AndroidVirtualDevice } from "../../constants";
import { getCurrentEpochTime, sleep } from "../../helpers";
import { EOL } from "os";

export class AndroidEmulatorServices implements Mobile.IEmulatorPlatformService {
	private endTimeEpoch: number = null;

	constructor(private $androidGenymotionService: Mobile.IAndroidVirtualDeviceService,
		private $androidVirtualDeviceService: Mobile.IAndroidVirtualDeviceService,
		private $adb: Mobile.IAndroidDebugBridge,
		private $emulatorHelper: Mobile.IEmulatorHelper,
		private $logger: ILogger,
		private $utils: IUtils) { }

	public async getAvailableEmulators(): Promise<Mobile.IAvailableEmulatorsOutput> {
		const adbDevicesOutput = await this.$adb.getDevices();
		const avdAvailableEmulatorsOutput = await this.$androidVirtualDeviceService.getAvailableEmulators(adbDevicesOutput);
		const genyAvailableDevicesOutput = await this.$androidGenymotionService.getAvailableEmulators(adbDevicesOutput);

		return {
			devices: avdAvailableEmulatorsOutput.devices.concat(genyAvailableDevicesOutput.devices),
			errors: avdAvailableEmulatorsOutput.errors.concat(genyAvailableDevicesOutput.errors)
		};
	}

	public async getRunningEmulatorIds(): Promise<string[]> {
		const adbDevicesOutput = await this.$adb.getDevices();
		const avds = await this.$androidVirtualDeviceService.getRunningEmulatorIds(adbDevicesOutput);
		const genies = await this.$androidGenymotionService.getRunningEmulatorIds(adbDevicesOutput);
		return avds.concat(genies);
	}

	public async getRunningEmulator(emulatorIdOrName: string, availableEmulators?: Mobile.IDeviceInfo[]): Promise<Mobile.IDeviceInfo> {
		if (!availableEmulators) {
			availableEmulators = (await this.getAvailableEmulators()).devices;
		}
		const emulator = this.$emulatorHelper.getEmulatorByIdOrName(emulatorIdOrName, availableEmulators);
		return this.$emulatorHelper.isEmulatorRunning(emulator) ? emulator : null;
	}

	public async startEmulator(options: Mobile.IStartEmulatorOptions): Promise<Mobile.IStartEmulatorOutput> {
		const output = await this.startEmulatorCore(options);
		let bootToCompleteOutput = null;
		if (output && output.runningEmulator) {
			bootToCompleteOutput = await this.waitForEmulatorBootToComplete(output.runningEmulator);
		}

		return {
			errors: ((output && output.errors) || []).concat((bootToCompleteOutput && bootToCompleteOutput.errors) || [])
		};
	}

	private async startEmulatorCore(options: Mobile.IAndroidStartEmulatorOptions): Promise<{runningEmulator: Mobile.IDeviceInfo, errors: string[]}> {
		this.endTimeEpoch = getCurrentEpochTime() + this.$utils.getMilliSecondsTimeout(AndroidVirtualDevice.TIMEOUT_SECONDS);
		const availableEmulators = (await this.getAvailableEmulators()).devices;
		let emulator = this.$emulatorHelper.getEmulatorByStartEmulatorOptions(options, availableEmulators);
		if (!emulator && !options.emulatorIdOrName && !options.imageIdentifier && !options.emulator) {
			emulator = this.getBestFit(availableEmulators);
		}
		if (!emulator) {
			return {
				runningEmulator: null,
				errors: [`No emulator image available for emulator '${options.emulatorIdOrName || options.imageIdentifier}'.`]
			};
		}

		if (emulator.vendor === AndroidVirtualDevice.AVD_VENDOR_NAME) {
			this.$androidVirtualDeviceService.startEmulator(emulator.imageIdentifier);
		} else if (emulator.vendor === AndroidVirtualDevice.GENYMOTION_VENDOR_NAME) {
			this.$androidGenymotionService.startEmulator(emulator.imageIdentifier);
		}

		const isInfiniteWait = this.$utils.getMilliSecondsTimeout(options.timeout || AndroidVirtualDevice.TIMEOUT_SECONDS) === 0;
		let hasTimeLeft = getCurrentEpochTime() < this.endTimeEpoch;

		while (hasTimeLeft || isInfiniteWait) {
			const runningEmulator = await this.getRunningEmulator(emulator.displayName, availableEmulators);
			if (runningEmulator) {
				return {
					runningEmulator,
					errors: []
				};
			}

			await sleep(10000); // the emulator definitely takes its time to wake up
			hasTimeLeft = getCurrentEpochTime() < this.endTimeEpoch;
		}

		if (!hasTimeLeft && !isInfiniteWait) {
			return {
				runningEmulator: null,
				errors: [AndroidVirtualDevice.UNABLE_TO_START_EMULATOR_MESSAGE]
			};
		}
	}

	private getBestFit(emulators: Mobile.IDeviceInfo[]) {
		const best = _(emulators).maxBy(emulator => emulator.version);
		return (best && best.version >= AndroidVirtualDevice.MIN_ANDROID_VERSION) ? best : null;
	}

	private async waitForEmulatorBootToComplete(emulator: Mobile.IDeviceInfo): Promise<{runningEmulator: Mobile.IDeviceInfo, errors: string[]}> {
		this.$logger.printInfoMessageOnSameLine("Waiting for emulator device initialization...");

		const isInfiniteWait = this.$utils.getMilliSecondsTimeout(AndroidVirtualDevice.TIMEOUT_SECONDS) === 0;
		while (getCurrentEpochTime() < this.endTimeEpoch || isInfiniteWait) {
			const isEmulatorBootCompleted = await this.isEmulatorBootCompleted(emulator.identifier);

			if (isEmulatorBootCompleted) {
				this.$logger.printInfoMessageOnSameLine(EOL);
				return {
					runningEmulator: emulator,
					errors: []
				};
			}

			this.$logger.printInfoMessageOnSameLine(".");
			await sleep(10000);
		}

		return {
			runningEmulator: null,
			errors: [AndroidVirtualDevice.UNABLE_TO_START_EMULATOR_MESSAGE]
		};
	}

	private async isEmulatorBootCompleted(emulatorId: string): Promise<boolean> {
		const output = await this.$adb.getPropertyValue(emulatorId, "dev.bootcomplete");
		const matches = output.match("1");
		return matches && matches.length > 0;
	}
}
$injector.register("androidEmulatorServices", AndroidEmulatorServices);
