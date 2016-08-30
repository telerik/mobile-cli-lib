import Future = require("fibers/future");
import * as fiberBootstrap from "../fiber-bootstrap";

export class DeviceLogService implements IDeviceLogService {
	constructor(private $deviceLogProvider: Mobile.IDeviceLogProvider,
		private $loggingLevels: Mobile.ILoggingLevels,
		private $devicesService: Mobile.IDevicesService) { }

	public printDeviceLog(deviceId: string, duration?: number): IFuture<void> {
		return (() => {
			this.$devicesService.initialize({ deviceId, skipInferPlatform: true }).wait();
			this.$deviceLogProvider.setLogLevel(this.$loggingLevels.full);

			if (duration) {
				this.printDeviceLogCore().wait();
				setTimeout(() => {
					fiberBootstrap.run(() => {
						let action = (device: Mobile.IDevice) => Future.fromResult(device.closeDeviceLogStream());
						this.$devicesService.execute(action).wait();
					});
				}, duration);
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
