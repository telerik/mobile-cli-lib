import byline = require("byline");
import {DeviceAndroidDebugBridge} from "./device-android-debug-bridge";
import {attachToProcessExitSignals} from "../../helpers";
import Future = require("fibers/future");

export class LogcatHelper implements Mobile.ILogcatHelper {
	private mapDeviceToLoggingStarted: IDictionary<boolean>;

	constructor(private $childProcess: IChildProcess,
		private $deviceLogProvider: Mobile.IDeviceLogProvider,
		private $devicePlatformsConstants: Mobile.IDevicePlatformsConstants,
		private $logger: ILogger,
		private $injector: IInjector) {
		this.mapDeviceToLoggingStarted = Object.create(null);
	}

	public start(deviceIdentifier: string): void {
		if (deviceIdentifier && !this.mapDeviceToLoggingStarted[deviceIdentifier]) {
			let adb: Mobile.IDeviceAndroidDebugBridge = this.$injector.resolve(DeviceAndroidDebugBridge, { identifier: deviceIdentifier });

			// remove cached logs:
			adb.executeCommand(["logcat", "-c"]).wait();

			let adbLogcat = adb.executeCommand(["logcat"], { returnChildProcess: true }).wait();
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
				this.$deviceLogProvider.logData(lineText, this.$devicePlatformsConstants.Android, deviceIdentifier);
			});

			attachToProcessExitSignals(this, () => Future.fromResult(adbLogcat.kill()));

			this.mapDeviceToLoggingStarted[deviceIdentifier] = true;
		}
	}
}

$injector.register("logcatHelper", LogcatHelper);
