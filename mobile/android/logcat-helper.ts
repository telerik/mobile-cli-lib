import byline = require("byline");
import { DeviceAndroidDebugBridge } from "./device-android-debug-bridge";
import { ChildProcess } from "child_process";

interface IDeviceLoggingData {
    loggingProcess: ChildProcess;
    lineStream: any;
}

export class LogcatHelper implements Mobile.ILogcatHelper {
	private mapDeviceToLoggingStarted: IDictionary<boolean>;
	private mapDevicesLoggingData: IDictionary<IDeviceLoggingData>;

	constructor(private $deviceLogProvider: Mobile.IDeviceLogProvider,
		private $devicePlatformsConstants: Mobile.IDevicePlatformsConstants,
		private $logger: ILogger,
		private $injector: IInjector,
		private $processService: IProcessService) {
		this.mapDeviceToLoggingStarted = Object.create(null);
		this.mapDevicesLoggingData = Object.create(null);
	}

	public async start(deviceIdentifier: string): Promise<void> {
		if (deviceIdentifier && !this.mapDevicesLoggingData[deviceIdentifier]) {
			const adb: Mobile.IDeviceAndroidDebugBridge = this.$injector.resolve(DeviceAndroidDebugBridge, { identifier: deviceIdentifier });

			const logcatStream = await adb.executeCommand(["logcat"], { returnChildProcess: true });
			const lineStream = byline(logcatStream.stdout);
			this.mapDevicesLoggingData[deviceIdentifier] = {
				loggingProcess: logcatStream,
				lineStream: lineStream
			}

			logcatStream.stderr.on("data", (data: NodeBuffer) => {
				this.$logger.trace("ADB logcat stderr: " + data.toString());
			});

			logcatStream.on("close", (code: number) => {
				try {
					this.stop(deviceIdentifier);
					if (code !== 0) {
						this.$logger.trace("ADB process exited with code " + code.toString());
					}
				} catch (err) {
					// Ignore the error, the process is dead.
				}
			});

			lineStream.on('data', (line: NodeBuffer) => {
				const lineText = line.toString();
				this.$deviceLogProvider.logData(lineText, this.$devicePlatformsConstants.Android, deviceIdentifier);
			});

			this.$processService.attachToProcessExitSignals(this, logcatStream.kill);
		}
	}

	public stop(deviceIdentifier: string): void {
		if(this.mapDevicesLoggingData[deviceIdentifier]) {
			this.mapDevicesLoggingData[deviceIdentifier].loggingProcess.removeAllListeners();
			this.mapDevicesLoggingData[deviceIdentifier].lineStream.removeAllListeners();
		}
		delete this.mapDevicesLoggingData[deviceIdentifier];
	}
}

$injector.register("logcatHelper", LogcatHelper);
