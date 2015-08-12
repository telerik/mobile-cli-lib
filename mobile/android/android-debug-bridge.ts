///<reference path="../../.d.ts"/>
"use strict";

import * as util from "util";

interface IComposeCommandResult {
	command: string;
	args: string[]
}

export class AndroidDebugBridge implements Mobile.IAndroidDebugBridge {
	constructor(private identifier: string,
		private $childProcess: IChildProcess,
		private $errors: IErrors,
		private $logger: ILogger,
		private $staticConfig: Config.IStaticConfig) { }


	public executeCommand(args: string[]): IFuture<any> {
		return (() => {
			let command = this.composeCommand(args).wait();
			return this.$childProcess.spawnFromEvent(command.command, command.args, "close", undefined, {throwError: false}).wait().stdout;
		}).future<any>()();
	}

	public executeShellCommand(args: string[]): IFuture<any> {
		return (() => {
			args.unshift("shell");
			let shellCommand = this.composeCommand(args).wait();
			return this.$childProcess.spawnFromEvent(shellCommand.command, shellCommand.args, "close", undefined, {throwError: false}).wait().stdout;
		}).future<any>()();
	}

	public sendBroadcastToDevice(action: string, extras: IStringDictionary = {}): IFuture<number> {
		return (() => {
			let broadcastCommand = ["am", "broadcast", "-a", `${action}`];
			_.each(extras, (value,key) => broadcastCommand.push("-e", key, value));

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
