///<reference path="../../.d.ts"/>
"use strict";
import byline = require("byline");

export class LogcatHelper implements Mobile.ILogcatHelper {
	constructor(private $childProcess: IChildProcess,
			private $deviceLogProvider: Mobile.IDeviceLogProvider,
			private $devicePlatformsConstants: Mobile.IDevicePlatformsConstants,
			private $logger: ILogger,
			private $staticConfig: Config.IStaticConfig) { }

	public start(deviceIdentifier: string): void {
		if(deviceIdentifier) {
			let adbPath = this.$staticConfig.getAdbFilePath().wait();
			// remove cached logs:
			this.$childProcess.spawnFromEvent(adbPath, ["-s", deviceIdentifier,  "logcat",  "-c"], "close",  {}, {throwError: false}).wait();
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
				this.$deviceLogProvider.logData(lineText, this.$devicePlatformsConstants.Android, deviceIdentifier);
			});
		}
	}
}
$injector.register("logcatHelper", LogcatHelper);
