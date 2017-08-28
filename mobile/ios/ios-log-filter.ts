export class IOSLogFilter implements Mobile.IPlatformLogFilter {
	protected infoFilterRegex = /^.*?(AppBuilder|Cordova|NativeScript).*?(<Notice>:.*?|<Warning>:.*?|<Error>:.*?)$/im;

	constructor(private $loggingLevels: Mobile.ILoggingLevels) { }

	public filterData(data: string, logLevel: string, pid?: string): string {
		const specifiedLogLevel = (logLevel || '').toUpperCase();

		if (specifiedLogLevel === this.$loggingLevels.info && data) {
			if (pid) {
				return data.indexOf(`[${pid}]`) !== -1 ? data.trim() : null;
			}

			const matchingInfoMessage = data.match(this.infoFilterRegex);
			return matchingInfoMessage ? matchingInfoMessage[2] : null;
		}

		return data;
	}
}

$injector.register("iOSLogFilter", IOSLogFilter);
