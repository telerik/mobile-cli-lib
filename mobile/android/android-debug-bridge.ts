import * as path from "path";

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
		const command = await this.composeCommand(args);
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
		const result: any = await this.$childProcess.spawnFromEvent(command.command, command.args, event, childProcessOptions, { throwError: false });

		const errors = this.$androidDebugBridgeResultHandler.checkForErrors(result);

		if (errors && errors.length > 0) {
			this.$androidDebugBridgeResultHandler.handleErrors(errors, treatErrorsAsWarnings);
		}

		// Some adb commands returns array of strings instead of object with stdout and stderr. (adb start-server)
		return (result.stdout === undefined || result.stdout === null) ? result : result.stdout;
	}

	protected async composeCommand(params: string[], identifier?: string): Promise<IComposeCommandResult> {
		const command = await this.$staticConfig.getAdbFilePath();
		let deviceIdentifier: string[] = [];
		if (identifier) {
			deviceIdentifier = ["-s", `${identifier}`];
		}

		const args: string[] = deviceIdentifier.concat(params);
		return { command, args };
	}

	public async executeShellCommand(args: string[], options?: Mobile.IAndroidDebugBridgeCommandOptions): Promise<any> {
		args.unshift("shell");
		const result = await this.executeCommand(args, options);

		return result;
	}

	public async pushFile(localFilePath: string, deviceFilePath: string): Promise<void> {
		const fileDirectory = path.normalize(path.dirname(deviceFilePath));
		// starting from API level 28, the push command is returning an error if the directory does not exist
		await this.executeShellCommand(["mkdir", "-p", fileDirectory]);
		await this.executeCommand(["push", localFilePath, deviceFilePath]);
		await this.executeShellCommand(["chmod", "0777", fileDirectory]);
	}
}

$injector.register("adb", AndroidDebugBridge);
