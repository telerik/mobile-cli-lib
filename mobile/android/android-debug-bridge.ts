interface IComposeCommandResult {
	command: string;
	args: string[];
}

export class AndroidDebugBridge implements Mobile.IAndroidDebugBridge {
	constructor(protected $childProcess: IChildProcess,
		protected $errors: IErrors,
		protected $logger: ILogger,
		protected $staticConfig: Config.IStaticConfig,
		protected $androidDebugBridgeResultHandler: Mobile.IAndroidDebugBridgeResultHandler) { }

	public async executeCommand(args: string[], options?: Mobile.IAndroidDebugBridgeCommandOptions): Promise<any> {
			let event = "close";
			let command = await  this.composeCommand(args);
			let treatErrorsAsWarnings = false;
			let childProcessOptions: any = undefined;

			if (options) {
				event = options.fromEvent || event;
				treatErrorsAsWarnings = options.treatErrorsAsWarnings;
				childProcessOptions = options.childProcessOptions;

				if (options.returnChildProcess) {
					return this.$childProcess.spawn(command.command, command.args);
				}
			}

			// If adb -s <invalid device id> install <smth> is executed the childProcess won't get any response
			// because the adb will be waiting for valid device and will not send close or exit event.
			// For example `adb -s <invalid device id> install <smth>` throws error 'error: device \'030939f508e6c773\' not found\r\n' exitCode 4294967295
			let result: any = await  this.$childProcess.spawnFromEvent(command.command, command.args, event, childProcessOptions, { throwError: false });

			let errors = this.$androidDebugBridgeResultHandler.checkForErrors(result);

			if (errors && errors.length > 0) {
				this.$androidDebugBridgeResultHandler.handleErrors(errors, treatErrorsAsWarnings);
			}

			// Some adb commands returns array of strings instead of object with stdout and stderr. (adb start-server)
			return (result.stdout === undefined || result.stdout === null) ? result : result.stdout;
	}

	protected async composeCommand(params: string[], identifier?: string): Promise<IComposeCommandResult> {
			let command = await  this.$staticConfig.getAdbFilePath();
			let deviceIdentifier: string[] = [];
			if (identifier) {
				deviceIdentifier = ["-s", `${identifier}`];
			}

			let args: string[] = deviceIdentifier.concat(params);
			return { command, args };
	}
}

$injector.register("adb", AndroidDebugBridge);
