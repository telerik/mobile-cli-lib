export class AndroidLogFilter implements Mobile.IPlatformLogFilter {

	//sample line is "I/Web Console(    4438): Received Event: deviceready at file:///storage/emulated/0/Icenium/com.telerik.TestApp/js/index.js:48"
	private static LINE_REGEX = /.\/(.+?)\s*\(\s*\d+?\): (.*)/;

	// sample line is "11-23 12:39:07.310  1584  1597 I art     : Background sticky concurrent mark sweep GC freed 21966(1780KB) AllocSpace objects, 4(80KB) LOS objects, 77% free, 840KB/3MB, paused 4.018ms total 158.629ms"
	// or '12-28 10:45:08.020  3329  3329 W chromium: [WARNING:data_reduction_proxy_settings.cc(328)] SPDY proxy OFF at startup'
	private static API_LEVEL_23_LINE_REGEX = /.+?\s+?(?:[A-Z]\s+?)([A-Za-z ]+?)\s*?\: (.*)/;

	constructor(private $loggingLevels: Mobile.ILoggingLevels) {}

	public filterData(data: string, logLevel: string): string {
		let specifiedLogLevel = (logLevel || '').toUpperCase();
		if(specifiedLogLevel === this.$loggingLevels.info) {
			let log = this.getConsoleLogFromLine(data);
			if(log) {
				if(log.tag) {
					return `${log.tag}: ${log.message}`;
				} else {
					return log.message;
				}
			}

			return null;
		}

		return data;
	}

	private getConsoleLogFromLine(lineText: string): any {
		let acceptedTags = ["chromium", "Web Console", "JS"];
		let match = lineText.match(AndroidLogFilter.LINE_REGEX) || lineText.match(AndroidLogFilter.API_LEVEL_23_LINE_REGEX);

		if (match && acceptedTags.indexOf(match[1].trim()) !== -1) {
			return { tag: match[1].trim(), message: match[2] };
		}
		let matchingTag = _.any(acceptedTags, (tag: string) => { return lineText.indexOf(tag) !== -1; });
		return matchingTag ? { message: lineText } : null;
	}
}
$injector.register("androidLogFilter", AndroidLogFilter);
