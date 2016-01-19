///<reference path="./../../.d.ts"/>
"use strict";

import {DeviceDiscovery} from "./device-discovery";
import Future = require("fibers/future");
import {IOSSimulator} from "./../ios/simulator/ios-simulator-device";

class IOSSimulatorDiscovery extends DeviceDiscovery {
	private cachedSimulator: Mobile.IiSimDevice;

	constructor(private $childProcess: IChildProcess,
		private $injector: IInjector,
		private $iOSSimResolver: Mobile.IiOSSimResolver,
		private $hostInfo: IHostInfo) {
		super();
	}

	public startLookingForDevices(): IFuture<void> {
		return this.checkForDevices(new Future<void>());
	}

	public checkForDevices(future?: IFuture<void>): IFuture<void> {
		if (this.$hostInfo.isDarwin && this.isSimulatorRunning().wait()) {
			let currentSimulator = this.$iOSSimResolver.iOSSim.getRunningSimulator();

			if (!this.cachedSimulator) {
				this.createAndAddDevice(currentSimulator);
			} else if (this.cachedSimulator.id !== currentSimulator.id) {
				this.removeDevice(this.cachedSimulator.id);
				this.createAndAddDevice(currentSimulator);
			}
		}

		if (future) {
			future.return();
		}

		return future || Future.fromResult();
	}

	private isSimulatorRunning(): IFuture<boolean> {
		return (() => {
			try {
				let output = this.$childProcess.exec("ps cax | grep launchd_sim").wait();
				return output.indexOf('launchd_sim') !== -1;
			} catch(e) {
				return false;
			}
		}).future<boolean>()();
	}

	private createAndAddDevice(simulator: Mobile.IiSimDevice): void {
		this.cachedSimulator = simulator;
		this.addDevice(this.$injector.resolve(IOSSimulator, {simulator: simulator}));
	}
}
$injector.register("iOSSimulatorDiscovery", IOSSimulatorDiscovery);
