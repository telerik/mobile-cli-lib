import { ChildProcess } from "child_process";

export class IOSSimulatorLogProvider implements Mobile.IiOSSimulatorLogProvider {
	private isStarted: boolean;

	constructor(private $iOSSimResolver: Mobile.IiOSSimResolver,
		private $deviceLogProvider: Mobile.IDeviceLogProvider,
		private $devicePlatformsConstants: Mobile.IDevicePlatformsConstants,
		private $processService: IProcessService) { }

	public startLogProcess(deviceIdentifier: string): void {
		if (!this.isStarted) {
			const deviceLogChildProcess: ChildProcess = this.$iOSSimResolver.iOSSim.getDeviceLogProcess(deviceIdentifier);

			const action = (data: NodeBuffer | string) => {
				this.$deviceLogProvider.logData(data.toString(), this.$devicePlatformsConstants.iOS, deviceIdentifier);
			};

			if (deviceLogChildProcess.stdout) {
				deviceLogChildProcess.stdout.on("data", action);
			}

			if (deviceLogChildProcess.stderr) {
				deviceLogChildProcess.stderr.on("data", action);
			}

			this.$processService.attachToProcessExitSignals(this, deviceLogChildProcess.kill);

			this.isStarted = true;
		}
	}
}
$injector.register("iOSSimulatorLogProvider", IOSSimulatorLogProvider);
