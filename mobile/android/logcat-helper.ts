import byline = require("byline");
import { DeviceAndroidDebugBridge } from "./device-android-debug-bridge";

export class LogcatHelper implements Mobile.ILogcatHelper {
	private mapDeviceToLoggingStarted: IDictionary<boolean>;
	private mapDeviceToLogcat:any;
	private mapDeviceToLineStream:any;

	constructor(private $deviceLogProvider: Mobile.IDeviceLogProvider,
		private $devicePlatformsConstants: Mobile.IDevicePlatformsConstants,
		private $logger: ILogger,
		private $injector: IInjector,
		private $processService: IProcessService) {
		this.mapDeviceToLoggingStarted = Object.create(null);
		this.mapDeviceToLogcat = Object.create(null);
		this.mapDeviceToLineStream = Object.create(null);
	}

	public async start(deviceIdentifier: string): Promise<void> {
		if (deviceIdentifier && !this.mapDeviceToLoggingStarted[deviceIdentifier]) {
			const adb: Mobile.IDeviceAndroidDebugBridge = this.$injector.resolve(DeviceAndroidDebugBridge, { identifier: deviceIdentifier });

			this.mapDeviceToLogcat[deviceIdentifier] = await adb.executeCommand(["logcat"], { returnChildProcess: true });
			this.mapDeviceToLineStream[deviceIdentifier] = byline(this.mapDeviceToLogcat[deviceIdentifier].stdout);

			this.mapDeviceToLogcat[deviceIdentifier].stderr.on("data", (data: NodeBuffer) => {
				this.$logger.trace("ADB logcat stderr: " + data.toString());
			});

			this.mapDeviceToLogcat[deviceIdentifier].on("close", (code: number) => {
				try {
					this.mapDeviceToLoggingStarted[deviceIdentifier] = false;
					if (code !== 0) {
						this.$logger.trace("ADB process exited with code " + code.toString());
					}
				} catch (err) {
					// Ignore the error, the process is dead.
				}
			});

			this.mapDeviceToLineStream[deviceIdentifier].on('data', (line: NodeBuffer) => {
				const lineText = line.toString();
				this.$deviceLogProvider.logData(lineText, this.$devicePlatformsConstants.Android, deviceIdentifier);
			});

			this.$processService.attachToProcessExitSignals(this, this.mapDeviceToLogcat[deviceIdentifier].kill);

			this.mapDeviceToLoggingStarted[deviceIdentifier] = true;
		}
	}

	public stop(deviceIdentifier: string): void {
		this.mapDeviceToLoggingStarted[deviceIdentifier] = false;
		if (this.mapDeviceToLogcat[deviceIdentifier]) {
			this.mapDeviceToLogcat[deviceIdentifier].removeAllListeners();
		}
		if (this.mapDeviceToLineStream[deviceIdentifier]) {
			this.mapDeviceToLineStream[deviceIdentifier].removeAllListeners();
		}
	}
}

$injector.register("logcatHelper", LogcatHelper);
