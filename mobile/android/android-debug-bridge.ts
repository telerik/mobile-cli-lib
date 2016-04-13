///<reference path="../../.d.ts"/>
"use strict";

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

	public executeCommand(args: string[], options?: Mobile.IAndroidDebugBridgeCommandOptions): IFuture<any> {
		return (() => {
			let event = "close";
			let command = this.composeCommand(args).wait();
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
			let result: any = this.$childProcess.spawnFromEvent(command.command, command.args, event, childProcessOptions, { throwError: false }).wait();

			let errors = this.$androidDebugBridgeResultHandler.checkForErrors(result);

			if (errors && errors.length > 0) {
				this.$androidDebugBridgeResultHandler.handleErrors(errors, treatErrorsAsWarnings);
			}

			// Some adb commands returns array of strings instead of object with stdout and stderr. (adb start-server)
			return result.stdout || result;
		}).future<any>()();
	}

	protected composeCommand(params: string[], identifier?: string): IFuture<IComposeCommandResult> {
		return (() => {
			let command = this.$staticConfig.getAdbFilePath().wait();
			let deviceIdentifier: string[] = [];
			if (identifier) {
				deviceIdentifier = ["-s", `${identifier}`];
			}

			let args: string[] = deviceIdentifier.concat(params);
			return { command, args };
		}).future<IComposeCommandResult>()();
	}
}

$injector.register("adb", AndroidDebugBridge);
