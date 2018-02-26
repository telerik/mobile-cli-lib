import { DeviceDiscovery } from "./device-discovery";
import { IOSSimulator } from "./../ios/simulator/ios-simulator-device";

export class IOSSimulatorDiscovery extends DeviceDiscovery {
	private cachedSimulators: Mobile.IiSimDevice[] = [];

	constructor(private $injector: IInjector,
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
			const currentSimulators: Mobile.IiSimDevice[] = await this.$iOSSimResolver.iOSSim.getRunningSimulators();

			// Remove old simulators
			_(this.cachedSimulators)
				.reject(s => _.find(currentSimulators, simulator => simulator && s && simulator.id === s.id && simulator.state === s.state))
				.each(s => this.deleteAndRemoveDevice(s));

			// Add new simulators
			_(currentSimulators)
				.reject(s => _.find(this.cachedSimulators, simulator => simulator && s && simulator.id === s.id && simulator.state === s.state))
				.each(s => this.createAndAddDevice(s));
		}

		if (resolve) {
			resolve();
		}
	}

	private createAndAddDevice(simulator: Mobile.IiSimDevice): void {
		this.cachedSimulators.push(_.cloneDeep(simulator));
		this.addDevice(this.$injector.resolve(IOSSimulator, { simulator: simulator }));
	}

	private deleteAndRemoveDevice(simulator: Mobile.IiSimDevice): void {
		_.remove(this.cachedSimulators, s => s && s.id === simulator.id);
		this.removeDevice(simulator.id);
	}
}

$injector.register("iOSSimulatorDiscovery", IOSSimulatorDiscovery);
