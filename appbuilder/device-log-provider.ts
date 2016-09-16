import { DeviceLogProviderBase } from "../mobile/device-log-provider-base";

export class DeviceLogProvider extends DeviceLogProviderBase {
	constructor(protected $logFilter: Mobile.ILogFilter,
		$logger: ILogger) {
		super($logFilter, $logger);
	}

	public logData(line: string, platform: string, deviceIdentifier: string): void {
		let logLevel = this.setLogLevelForDevice(deviceIdentifier);

		let applicationPid = this.getApplicationPidForDevice(deviceIdentifier),
			data = this.$logFilter.filterData(platform, line, applicationPid, logLevel);

		if (data) {
			this.emit('data', deviceIdentifier, data);
		}
	}

	public setLogLevel(logLevel: string, deviceIdentifier?: string): void {
		if (deviceIdentifier) {
			this.devicesLogOptions[deviceIdentifier] = this.devicesLogOptions[deviceIdentifier] || <Mobile.IDeviceLogOptions> { };
			this.devicesLogOptions[deviceIdentifier].logLevel = logLevel.toUpperCase();
		} else {
			this.$logFilter.loggingLevel = logLevel.toUpperCase();

			_.each(this.devicesLogOptions, (deviceLogLevel: string, deviceId: string) => {
				this.devicesLogOptions[deviceId] = this.devicesLogOptions[deviceId] || <Mobile.IDeviceLogOptions> { };
				this.devicesLogOptions[deviceId].logLevel = this.$logFilter.loggingLevel;
			});
		}
	}
}
$injector.register("deviceLogProvider", DeviceLogProvider);
