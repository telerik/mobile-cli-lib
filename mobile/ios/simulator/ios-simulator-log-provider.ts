import { ChildProcess } from "child_process";

export class IOSSimulatorLogProvider implements Mobile.IiOSSimulatorLogProvider {
	private simulatorsLoggingEnabled: IDictionary<boolean> = {};

	constructor(private $iOSSimResolver: Mobile.IiOSSimResolver,
		private $deviceLogProvider: Mobile.IDeviceLogProvider,
		private $devicePlatformsConstants: Mobile.IDevicePlatformsConstants,
		private $logger: ILogger,
		private $processService: IProcessService) { }

	public startLogProcess(deviceIdentifier: string): void {
		if (!this.simulatorsLoggingEnabled[deviceIdentifier]) {
			const deviceLogChildProcess: ChildProcess = this.$iOSSimResolver.iOSSim.getDeviceLogProcess(deviceIdentifier, 'senderImagePath contains "NativeScript"');

			const action = (data: NodeBuffer | string) => {
				this.$deviceLogProvider.logData(data.toString(), this.$devicePlatformsConstants.iOS, deviceIdentifier);
			};

			if (deviceLogChildProcess) {
				deviceLogChildProcess.once("close", () => {
					this.simulatorsLoggingEnabled[deviceIdentifier] = false;
				});

				deviceLogChildProcess.once("error", (err) => {
					this.$logger.trace(`Error is thrown for device with identifier ${deviceIdentifier}. More info: ${err.message}.`);
					this.simulatorsLoggingEnabled[deviceIdentifier] = false;
				});
			}

			if (deviceLogChildProcess.stdout) {
				deviceLogChildProcess.stdout.on("data", action);
			}

			if (deviceLogChildProcess.stderr) {
				deviceLogChildProcess.stderr.on("data", action);
			}

			this.$processService.attachToProcessExitSignals(this, deviceLogChildProcess.kill);

			this.simulatorsLoggingEnabled[deviceIdentifier] = true;
		}
	}
}
$injector.register("iOSSimulatorLogProvider", IOSSimulatorLogProvider);
