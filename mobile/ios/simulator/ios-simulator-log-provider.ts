import { ChildProcess } from "child_process";

export class IOSSimulatorLogProvider implements Mobile.IiOSSimulatorLogProvider {
	private deviceLogChildProcess: ChildProcess;

	constructor(private $iOSSimResolver: Mobile.IiOSSimResolver,
		private $deviceLogProvider: Mobile.IDeviceLogProvider,
		private $devicePlatformsConstants: Mobile.IDevicePlatformsConstants,
		private $processService: IProcessService) { }

	public startLogProcess(deviceIdentifier: string): ChildProcess {
		if (!this.deviceLogChildProcess) {
			this.deviceLogChildProcess = this.$iOSSimResolver.iOSSim.getDeviceLogProcess(deviceIdentifier);

			let action = (data: NodeBuffer | string) => this.$deviceLogProvider.logData(data.toString(), this.$devicePlatformsConstants.iOS, deviceIdentifier);

			if (this.deviceLogChildProcess.stdout) {
				this.deviceLogChildProcess.stdout.on("data", action);
			}

			if (this.deviceLogChildProcess.stderr) {
				this.deviceLogChildProcess.stderr.on("data", action);
			}

			this.$processService.attachToProcessExitSignals(this, this.deviceLogChildProcess.kill);
		}

		return this.deviceLogChildProcess;
	}
}
$injector.register("iOSSimulatorLogProvider", IOSSimulatorLogProvider);
