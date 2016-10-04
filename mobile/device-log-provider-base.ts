import { EventEmitter } from "events";
import { getPropertyName } from "../helpers";

export abstract class DeviceLogProviderBase extends EventEmitter implements Mobile.IDeviceLogProvider {
	protected devicesLogOptions: IDictionary<Mobile.IDeviceLogOptions> = {};

	constructor(protected $logFilter: Mobile.ILogFilter,
		protected $logger: ILogger) {
		super();
	}

	public abstract logData(lineText: string, platform: string, deviceIdentifier: string): void;

	public abstract setLogLevel(logLevel: string, deviceIdentifier?: string): void;

	public setApplictionPidForDevice(deviceIdentifier: string, pid: string): void {
		this.setDeviceLogOptionsProperty(deviceIdentifier, (deviceLogOptions: Mobile.IDeviceLogOptions) => deviceLogOptions.applicationPid, pid);
	}

	protected setDefaultLogLevelForDevice(deviceIdentifier: string): string {
		let logLevel = (this.devicesLogOptions[deviceIdentifier] && this.devicesLogOptions[deviceIdentifier].logLevel) || this.$logFilter.loggingLevel;
		this.setLogLevel(logLevel, deviceIdentifier);

		return logLevel;
	}

	protected getApplicationPidForDevice(deviceIdentifier: string): string {
		return this.devicesLogOptions[deviceIdentifier] && this.devicesLogOptions[deviceIdentifier].applicationPid;
	}

	protected setDeviceLogOptionsProperty(deviceIdentifier: string, propNameFunction: Function, propertyValue: string): void {
		let propertyName = getPropertyName(propNameFunction);

		if (propertyName) {
			this.devicesLogOptions[deviceIdentifier] = this.devicesLogOptions[deviceIdentifier] || <Mobile.IDeviceLogOptions>{};
			this.devicesLogOptions[deviceIdentifier][propertyName] = propertyValue;
		}
	}
}
