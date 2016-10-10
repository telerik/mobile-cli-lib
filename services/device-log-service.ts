import Future = require("fibers/future");
import {executeActionForSpecificDuration} from "../helpers";

export class DeviceLogService implements IDeviceLogService {
	constructor(private $deviceLogProvider: Mobile.IDeviceLogProvider,
		private $devicesService: Mobile.IDevicesService) { }

	public printDeviceLog(deviceId: string, duration?: number, loggingLevel?: string): IFuture<void> {
		return (() => {
			this.$devicesService.initialize({ deviceId, skipInferPlatform: true }).wait();

			if (loggingLevel) {
				this.$deviceLogProvider.setLogLevel(loggingLevel);
			}

			if (duration) {
				let printDeviceLog: IMethodDescription = { method: this.printDeviceLogCore, context: this };
				let stopPrintingDeviceLog: IMethodDescription = {
					method: () => {
						let action = (device: Mobile.IDevice) => Future.fromResult(device.closeDeviceLogStream());
						return this.$devicesService.execute(action);
					},
					context: this
				};

				executeActionForSpecificDuration(printDeviceLog, stopPrintingDeviceLog, duration * 1000).wait();
			} else {
				this.printDeviceLogCore().wait();
			}
		}).future<void>()();
	}

	private printDeviceLogCore(): IFuture<void> {
		return (() => {
			let action = (device: Mobile.IDevice) => Future.fromResult(device.openDeviceLogStream());
			this.$devicesService.execute(action).wait();
		}).future<void>()();
	}
}

$injector.register("deviceLogService", DeviceLogService);
