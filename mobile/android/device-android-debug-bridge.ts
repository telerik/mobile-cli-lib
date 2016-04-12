///<reference path="../../.d.ts"/>
"use strict";

import {AndroidDebugBridge} from "./android-debug-bridge";

interface IComposeCommandResult {
	command: string;
	args: string[];
}

export class DeviceAndroidDebugBridge extends AndroidDebugBridge implements Mobile.IDeviceAndroidDebugBridge {
	constructor(private identifier: string,
		protected $childProcess: IChildProcess,
		protected $errors: IErrors,
		protected $logger: ILogger,
		protected $staticConfig: Config.IStaticConfig,
		protected $androidDebugBridgeResultHandler: Mobile.IAndroidDebugBridgeResultHandler) {
		super($childProcess, $errors, $logger, $staticConfig, $androidDebugBridgeResultHandler);
	}

	public executeShellCommand(args: string[], fromEvent?: string): IFuture<any> {
		return (() => {
			let event = fromEvent || "close";
			args.unshift("shell");
			let shellCommand = this.composeCommand(args).wait();
			let result: any = this.$childProcess.spawnFromEvent(shellCommand.command, shellCommand.args, event, undefined, { throwError: false }).wait();

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

	protected composeCommand(params: string[]): IFuture<IComposeCommandResult> {
		return super.composeCommand(params, this.identifier);
	}
}
