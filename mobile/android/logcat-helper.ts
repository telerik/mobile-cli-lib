import byline = require("byline");
import { DeviceAndroidDebugBridge } from "./device-android-debug-bridge";

export class LogcatHelper implements Mobile.ILogcatHelper {
	private mapDeviceToLoggingStarted: IDictionary<boolean>;
	private adbLogcat:any;
	private lineStream:any;

	constructor(private $deviceLogProvider: Mobile.IDeviceLogProvider,
		private $devicePlatformsConstants: Mobile.IDevicePlatformsConstants,
		private $logger: ILogger,
		private $injector: IInjector,
		private $processService: IProcessService) {
		this.mapDeviceToLoggingStarted = Object.create(null);
	}

	public async start(deviceIdentifier: string): Promise<void> {
		if (deviceIdentifier && !this.mapDeviceToLoggingStarted[deviceIdentifier]) {
			const adb: Mobile.IDeviceAndroidDebugBridge = this.$injector.resolve(DeviceAndroidDebugBridge, { identifier: deviceIdentifier });

			this.adbLogcat = await adb.executeCommand(["logcat"], { returnChildProcess: true });
			this.lineStream = byline(this.adbLogcat.stdout);

			this.adbLogcat.stderr.on("data", (data: NodeBuffer) => {
				this.$logger.trace("ADB logcat stderr: " + data.toString());
			});

			this.adbLogcat.on("close", (code: number) => {
				try {
					this.mapDeviceToLoggingStarted[deviceIdentifier] = false;
					if (code !== 0) {
						this.$logger.trace("ADB process exited with code " + code.toString());
					}
				} catch (err) {
					// Ignore the error, the process is dead.
				}
			});

			this.lineStream.on('data', (line: NodeBuffer) => {
				const lineText = line.toString();
				this.$deviceLogProvider.logData(lineText, this.$devicePlatformsConstants.Android, deviceIdentifier);
			});

			this.$processService.attachToProcessExitSignals(this, this.adbLogcat.kill);

			this.mapDeviceToLoggingStarted[deviceIdentifier] = true;
		}
	}

	public stop(deviceIdentifier: string): void {
		this.mapDeviceToLoggingStarted[deviceIdentifier] = false;
		if (this.adbLogcat) { this.adbLogcat.removeAllListeners(); }
		if (this.lineStream) { this.lineStream.removeAllListeners(); }
	}
}

$injector.register("logcatHelper", LogcatHelper);
