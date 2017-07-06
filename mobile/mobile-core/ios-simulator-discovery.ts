import { DeviceDiscovery } from "./device-discovery";
import { IOSSimulator } from "./../ios/simulator/ios-simulator-device";

export class IOSSimulatorDiscovery extends DeviceDiscovery {
	private cachedSimulator: Mobile.IiSimDevice;

	constructor(private $injector: IInjector,
		private $childProcess: IChildProcess,
		private $iOSSimResolver: Mobile.IiOSSimResolver,
		private $mobileHelper: Mobile.IMobileHelper,
		private $hostInfo: IHostInfo) {
		super();
	}

	public async startLookingForDevices(options?: Mobile.IDeviceLookingOptions): Promise<void> {
		if (options && options.platform && !this.$mobileHelper.isiOSPlatform(options.platform)) {
			return;
		}

		return new Promise<void>((resolve, reject) => {
			return this.checkForDevices(resolve, reject);
		});
	}

	public async checkForDevices(resolve?: (value?: void | PromiseLike<void>) => void, reject?: (reason?: any) => void): Promise<void> {
		if (this.$hostInfo.isDarwin) {
			let currentSimulator: any = null;
			if (await this.isSimulatorRunning()) {
				currentSimulator = await this.$iOSSimResolver.iOSSim.getRunningSimulator();
			}

			if (currentSimulator) {
				if (!this.cachedSimulator) {
					this.createAndAddDevice(currentSimulator);
				} else if (this.cachedSimulator.id !== currentSimulator.id) {
					this.removeDevice(this.cachedSimulator.id);
					this.createAndAddDevice(currentSimulator);
				}
			} else if (this.cachedSimulator) {
				// In case there's no running simulator, but it's been running before, we should report it as removed.
				this.removeDevice(this.cachedSimulator.id);
				this.cachedSimulator = null;
			}
		}

		if (resolve) {
			resolve();
		}
	}

	private async isSimulatorRunning(): Promise<boolean> {
		try {
			let output = await this.$childProcess.exec("ps cax | grep launchd_sim");
			return output.indexOf('launchd_sim') !== -1;
		} catch (e) {
			return false;
		}
	}

	private createAndAddDevice(simulator: Mobile.IiSimDevice): void {
		this.cachedSimulator = _.cloneDeep(simulator);
		this.addDevice(this.$injector.resolve(IOSSimulator, { simulator: this.cachedSimulator }));
	}
}

$injector.register("iOSSimulatorDiscovery", IOSSimulatorDiscovery);
