import { DeviceLogProviderBase } from "./device-log-provider-base";

export class DeviceLogProvider extends DeviceLogProviderBase {
	constructor(protected $logFilter: Mobile.ILogFilter,
		protected $logger: ILogger) {
		super($logFilter, $logger);
	}

	public logData(lineText: string, platform: string, deviceIdentifier: string): void {
		let applicationPid = this.getApplicationPidForDevice(deviceIdentifier);

		let data = this.$logFilter.filterData(platform, lineText, applicationPid);
		if (data) {
			this.$logger.out(data);
		}
	}

	public setLogLevel(logLevel: string, deviceIdentifier?: string): void {
		this.$logFilter.loggingLevel = logLevel.toUpperCase();
	}
}
$injector.register("deviceLogProvider", DeviceLogProvider);
