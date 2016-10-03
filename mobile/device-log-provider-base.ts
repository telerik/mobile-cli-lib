import { EventEmitter } from "events";

export abstract class DeviceLogProviderBase extends EventEmitter implements Mobile.IDeviceLogProvider {
	protected devicesLogOptions: IDictionary<Mobile.IDeviceLogOptions> = {};

	constructor(protected $logFilter: Mobile.ILogFilter,
		protected $logger: ILogger) {
		super();
	}

	public abstract logData(lineText: string, platform: string, deviceIdentifier: string): void;

	public abstract setLogLevel(logLevel: string, deviceIdentifier?: string): void;

	public setApplictionPidForDevice(deviceIdentifier: string, pid: string): void {
		this.devicesLogOptions[deviceIdentifier] = this.devicesLogOptions[deviceIdentifier] || <Mobile.IDeviceLogOptions>{};
		this.devicesLogOptions[deviceIdentifier].applicationPid = pid;
	}

	protected setLogLevelForDevice(deviceIdentifier: string, logLevel?: string): string {
		logLevel = logLevel || this.$logFilter.loggingLevel;

		if (deviceIdentifier) {
			logLevel = (this.devicesLogOptions[deviceIdentifier] && this.devicesLogOptions[deviceIdentifier].logLevel) || this.$logFilter.loggingLevel;
			this.setLogLevel(logLevel, deviceIdentifier);
		}

		return logLevel;
	}

	protected getApplicationPidForDevice(deviceIdentifier: string): string {
		return this.devicesLogOptions[deviceIdentifier] && this.devicesLogOptions[deviceIdentifier].applicationPid;
	}
}
