import {DeviceDiscovery} from "./device-discovery";
import Future = require("fibers/future");
import {IOSSimulator} from "./../ios/simulator/ios-simulator-device";

export class IOSSimulatorDiscovery extends DeviceDiscovery {
	private cachedSimulator: Mobile.IiSimDevice;

	constructor(private $injector: IInjector,
		private $iOSSimResolver: Mobile.IiOSSimResolver,
		private $hostInfo: IHostInfo) {
		super();
	}

	public startLookingForDevices(): IFuture<void> {
		return this.checkForDevices(new Future<void>());
	}

	public checkForDevices(future?: IFuture<void>): IFuture<void> {
		if (this.$hostInfo.isDarwin) {
			let currentSimulator = this.$iOSSimResolver.iOSSim.getRunningSimulator();

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

		if (future) {
			future.return();
		}

		return future || Future.fromResult();
	}

	private createAndAddDevice(simulator: Mobile.IiSimDevice): void {
		this.cachedSimulator = _.cloneDeep(simulator);
		this.addDevice(this.$injector.resolve(IOSSimulator, { simulator: this.cachedSimulator }));
	}
}

$injector.register("iOSSimulatorDiscovery", IOSSimulatorDiscovery);
