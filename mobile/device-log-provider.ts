export class DeviceLogProvider implements Mobile.IDeviceLogProvider {
	constructor(private $logFilter: Mobile.ILogFilter,
		private $logger: ILogger) { }

	public logData(lineText: string, platform: string, deviceIdentifier: string): void {
		let data = this.$logFilter.filterData(platform, lineText);
		if(data) {
			this.$logger.out(data);
		}
	}

	public setLogLevel(logLevel: string, deviceIdentifier?: string): void {
		this.$logFilter.loggingLevel = logLevel.toUpperCase();
	}
}
$injector.register("deviceLogProvider", DeviceLogProvider);
