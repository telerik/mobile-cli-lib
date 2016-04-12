///<reference path="../../.d.ts"/>
"use strict";

import {EOL} from "os";

interface IComposeCommandResult {
	command: string;
	args: string[];
}

export class AndroidDebugBridge implements Mobile.IAndroidDebugBridge {
	constructor(private identifier: string,
		private $childProcess: IChildProcess,
		private $errors: IErrors,
		private $logger: ILogger,
		private $staticConfig: Config.IStaticConfig,
		private $androidDebugBridgeResultHandler: Mobile.IAndroidDebugBridgeResultHandler) { }

	public executeCommand(args: string[]): IFuture<any> {
		return (() => {
			let command = this.composeCommand(args).wait();
			// If adb -s <invalid device id> install <smth> is executed the childProcess won't get any response
			// because the adb will be waiting for valid device and will not send close or exit event.
			// For example `adb -s <invalid device id> install <smth>` throws error 'error: device \'030939f508e6c773\' not found\r\n' exitCode 4294967295
			let result: any = this.$childProcess.spawnFromEvent(command.command, command.args, "close", undefined, { throwError: false }).wait();

			let errors = this.$androidDebugBridgeResultHandler.checkForErrors(result);

			if (errors && errors.length > 0) {
				this.$androidDebugBridgeResultHandler.handleErrors(errors);
			}

			return result.stdout;
		}).future<any>()();
	}

	public executeShellCommand(args: string[]): IFuture<any> {
		return (() => {
			args.unshift("shell");
			let shellCommand = this.composeCommand(args).wait();
			let result: any = this.$childProcess.spawnFromEvent(shellCommand.command, shellCommand.args, "close", undefined, { throwError: false }).wait();

			let errors = this.$androidDebugBridgeResultHandler.checkForErrors(result);

			if (errors && errors.length > 0) {
				this.$androidDebugBridgeResultHandler.handleErrors(errors);
			}

			return result.stdout;
		}).future<any>()();
	}

	public sendBroadcastToDevice(action: string, extras: IStringDictionary = {}): IFuture<number> {
		return (() => {
			let broadcastCommand = ["am", "broadcast", "-a", `${action}`];
			_.each(extras, (value, key) => broadcastCommand.push("-e", key, value));

			let result = this.executeShellCommand(broadcastCommand).wait();
			this.$logger.trace(`Broadcast result ${result} from ${broadcastCommand}`);

			let match = result.match(/Broadcast completed: result=(\d+)/);
			if (match) {
				return +match[1];
			}

			this.$errors.failWithoutHelp("Unable to broadcast to android device:\n%s", result);
		}).future<number>()();
	}

	private composeCommand(params: string[]): IFuture<IComposeCommandResult> {
		return (() => {
			let command = this.$staticConfig.getAdbFilePath().wait();
			let args: string[] = ["-s", `${this.identifier}`].concat(params);
			return { command, args };
		}).future<IComposeCommandResult>()();
	}
}
