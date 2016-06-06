import { EventEmitter } from "events";

export class DeviceLogProvider extends EventEmitter implements Mobile.IDeviceLogProvider {
	private devicesLogLevel: IStringDictionary = {};

	constructor(private $logFilter: Mobile.ILogFilter) {
		super();
	}

	public logData(line: string, platform: string, deviceIdentifier?: string): void {
		let logLevel = this.$logFilter.loggingLevel;
		if(deviceIdentifier) {
			logLevel = this.devicesLogLevel[deviceIdentifier] = this.devicesLogLevel[deviceIdentifier] || this.$logFilter.loggingLevel;
		}

		let data = this.$logFilter.filterData(platform, line, logLevel);
		if(data) {
			this.emit('data', deviceIdentifier, data);
		}
	}

	public setLogLevel(logLevel: string, deviceIdentifier?: string): void {
		if(deviceIdentifier) {
			this.devicesLogLevel[deviceIdentifier] = logLevel.toUpperCase();
		} else {
			this.$logFilter.loggingLevel = logLevel.toUpperCase();
			_.each(this.devicesLogLevel, (deviceLogLevel: string, deviceId: string) => {
				this.devicesLogLevel[deviceId] = this.$logFilter.loggingLevel;
			});
		}
	}
}
$injector.register("deviceLogProvider", DeviceLogProvider);
