import { ChildProcess } from "child_process";
import { DEVICE_LOG_EVENT_NAME } from "../../../constants";
import { EventEmitter } from "events";

export class IOSSimulatorLogProvider extends EventEmitter implements Mobile.IiOSSimulatorLogProvider {
	private simulatorsLoggingEnabled: IDictionary<boolean> = {};

	constructor(private $iOSSimResolver: Mobile.IiOSSimResolver,
		private $logger: ILogger,
		private $processService: IProcessService) {
			super();
		}

	public startLogProcess(deviceId: string, options?: Mobile.IiOSLogStreamOptions): void {
		if (!this.simulatorsLoggingEnabled[deviceId]) {
			const deviceLogChildProcess: ChildProcess = this.$iOSSimResolver.iOSSim.getDeviceLogProcess(deviceId, options ? options.predicate : null);

			const action = (data: NodeBuffer | string) => {
				const message = data.toString();
				this.emit(DEVICE_LOG_EVENT_NAME, { deviceId, message, muted: (options || {}).muted });
			};

			if (deviceLogChildProcess) {
				deviceLogChildProcess.once("close", () => {
					this.simulatorsLoggingEnabled[deviceId] = false;
				});

				deviceLogChildProcess.once("error", (err) => {
					this.$logger.trace(`Error is thrown for device with identifier ${deviceId}. More info: ${err.message}.`);
					this.simulatorsLoggingEnabled[deviceId] = false;
				});
			}

			if (deviceLogChildProcess.stdout) {
				deviceLogChildProcess.stdout.on("data", action.bind(this));
			}

			if (deviceLogChildProcess.stderr) {
				deviceLogChildProcess.stderr.on("data", action.bind(this));
			}

			this.$processService.attachToProcessExitSignals(this, deviceLogChildProcess.kill);

			this.simulatorsLoggingEnabled[deviceId] = true;
		}
	}

	public startNewMutedLogProcess(deviceId: string, options?: Mobile.IiOSLogStreamOptions): void {
		options = options || {};
		options.muted = true;
		this.simulatorsLoggingEnabled[deviceId] = false;
		this.startLogProcess(deviceId, options);
		this.simulatorsLoggingEnabled[deviceId] = false;
	}
}
$injector.register("iOSSimulatorLogProvider", IOSSimulatorLogProvider);
