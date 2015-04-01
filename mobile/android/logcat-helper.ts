///<reference path="../../../.d.ts"/>
"use strict";
import byline = require("byline");

export class LogcatHelper implements Mobile.ILogcatHelper {
	private lineRegex = /.\/(.+?)\s*\(\s*(\d+?)\): (.*)/;

	constructor(private $childProcess: IChildProcess,
		    private $logger: ILogger) {

	}

	public start(deviceIdentifier: string, adbPath: string): any {
		var adbLogcat = this.$childProcess.spawn(adbPath, ["-s", deviceIdentifier, "logcat"]);
		var lineStream = byline(adbLogcat.stdout);

		adbLogcat.stderr.on("data", (data: NodeBuffer) => {
			this.$logger.trace("ADB logcat stderr: " + data.toString());
		});

		adbLogcat.on("close", (code: number) => {
			if(code !== 0) {
				this.$logger.trace("ADB process exited with code " + code.toString());
			}
		});

		lineStream.on('data', (line: NodeBuffer) => {
			var lineText = line.toString();
			var log = this.getConsoleLogFromLine(lineText);
			if(log) {
				if(log.tag) {
					this.$logger.out("%s: %s", log.tag, log.message);
				} else {
					this.$logger.out(log.message);
				}
			}
		});

		return adbLogcat;
	}

	private getConsoleLogFromLine(lineText: String): any {
		var acceptedTags = ["chromium", "Web Console", "JS"];

		//sample line is "I/Web Console(    4438): Received Event: deviceready at file:///storage/emulated/0/Icenium/com.telerik.TestApp/js/index.js:48"
		var match = lineText.match(this.lineRegex);
		if(match) {
			if(acceptedTags.indexOf(match[1]) !== -1) {
				return {tag: match[1], message: match[3]};
			}
		} else if(_.any(acceptedTags, (tag: string) => { return lineText.indexOf(tag) !== -1; })) {
			return {message: match[3]};
		}

		return null;
	}
}
$injector.register("logcatHelper", LogcatHelper);
