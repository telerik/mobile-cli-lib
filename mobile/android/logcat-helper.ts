import byline = require("byline");
import { DeviceAndroidDebugBridge } from "./device-android-debug-bridge";

export class LogcatHelper implements Mobile.ILogcatHelper {
	private mapDeviceToLoggingStarted: IDictionary<boolean>;

	constructor(private $childProcess: IChildProcess,
		private $deviceLogProvider: Mobile.IDeviceLogProvider,
		private $devicePlatformsConstants: Mobile.IDevicePlatformsConstants,
		private $logger: ILogger,
		private $injector: IInjector,
		private $processService: IProcessService) {
		this.mapDeviceToLoggingStarted = Object.create(null);
	}

	public async start(deviceIdentifier: string): Promise<void> {
		if (deviceIdentifier && !this.mapDeviceToLoggingStarted[deviceIdentifier]) {
			let adb: Mobile.IDeviceAndroidDebugBridge = this.$injector.resolve(DeviceAndroidDebugBridge, { identifier: deviceIdentifier });

			// remove cached logs:
			await adb.executeCommand(["logcat", "-c"]);

			let adbLogcat = await adb.executeCommand(["logcat"], { returnChildProcess: true });
			let lineStream = byline(adbLogcat.stdout);

			adbLogcat.stderr.on("data", (data: NodeBuffer) => {
				this.$logger.trace("ADB logcat stderr: " + data.toString());
			});

			adbLogcat.on("close", (code: number) => {
				try {
					this.mapDeviceToLoggingStarted[deviceIdentifier] = false;
					if (code !== 0) {
						this.$logger.trace("ADB process exited with code " + code.toString());
					}
				} catch (err) {
					// Ignore the error, the process is dead.
				}
			});

			lineStream.on('data', (line: NodeBuffer) => {
				let lineText = line.toString();
				this.$deviceLogProvider.logData(lineText, this.$devicePlatformsConstants.Android, deviceIdentifier)
			});

			this.$processService.attachToProcessExitSignals(this, adbLogcat.kill);

			this.mapDeviceToLoggingStarted[deviceIdentifier] = true;
		}
	}
}

$injector.register("logcatHelper", LogcatHelper);
