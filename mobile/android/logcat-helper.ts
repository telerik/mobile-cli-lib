///<reference path="../../.d.ts"/>
"use strict";
import byline = require("byline");
import util = require("util");

export class LogcatHelper implements Mobile.ILogcatHelper {
	constructor(private $childProcess: IChildProcess,
		    private $logcatPrinter: Mobile.ILogcatPrinter,
			private $logger: ILogger,
			private $staticConfig: Config.IStaticConfig) { }

	public start(deviceIdentifier: string): any {
		let adbPath = this.$staticConfig.getAdbFilePath().wait();
		this.$childProcess.exec(util.format("%s -s %s logcat -c", adbPath, deviceIdentifier)).wait(); // remove cached logs
		let adbLogcat = this.$childProcess.spawn(adbPath, ["-s", deviceIdentifier, "logcat"]);
		let lineStream = byline(adbLogcat.stdout);

		adbLogcat.stderr.on("data", (data: NodeBuffer) => {
			this.$logger.trace("ADB logcat stderr: " + data.toString());
		});

		adbLogcat.on("close", (code: number) => {
			if(code !== 0) {
				this.$logger.trace("ADB process exited with code " + code.toString());
			}
		});

		lineStream.on('data', (line: NodeBuffer) => {
			let lineText = line.toString();
			this.$logcatPrinter.print(lineText);
		});

		return adbLogcat;
	}
}
$injector.register("logcatHelper", LogcatHelper);
