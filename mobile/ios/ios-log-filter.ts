export class IOSLogFilter implements Mobile.IPlatformLogFilter {
	protected infoFilterRegex = /^.*?(AppBuilder|Cordova|NativeScript).*?(<Notice>:.*?|<Warning>:.*?|<Error>:.*?)$/im;

	constructor(private $loggingLevels: Mobile.ILoggingLevels) { }

	public filterData(data: string, logLevel: string, pid?: string): string {
		let specifiedLogLevel = (logLevel || '').toUpperCase();

		if (specifiedLogLevel === this.$loggingLevels.info && data) {
			if (pid) {
				return data.indexOf(`[${pid}]`) !== -1 ? data.trim() : null;
			}

			let matchingInfoMessage = data.match(this.infoFilterRegex);
			return matchingInfoMessage ? matchingInfoMessage[2] : null;
		}

		return data;
	}
}

$injector.register("iOSLogFilter", IOSLogFilter);
