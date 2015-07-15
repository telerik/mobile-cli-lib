///<reference path="../../../.d.ts"/>
"use strict";

import util = require("util");

export class AndroidDebugBridge implements Mobile.IAndroidDebugBridge {
	constructor(private identifier: string,
		private $childProcess: IChildProcess,
		private $errors: IErrors,	
		private $logger: ILogger,	
		private $staticConfig: Config.IStaticConfig) { }
	

	public executeCommand(...args: string[]): IFuture<any> {
		return (() => {
			let command = this.composeCommand(args).wait();
			return this.$childProcess.exec(command).wait();
		}).future<any>()();
	}
	
	public executeShellCommand(...args: string[]): IFuture<any> {
		return (() => {
			args.unshift("shell");
			let shellCommand = this.composeCommand(args).wait();
			this.$logger.trace(`Shell command ${shellCommand}`);
			return this.$childProcess.exec(shellCommand).wait();
		}).future<any>()();
	}
	
	public sendBroadcastToDevice(action: string, extras: IStringDictionary = {}): IFuture<number> {
		return (() => {
			let broadcastCommand = `am broadcast -a "${action}"`;
			_.each(extras, (value,key) => broadcastCommand += ` -e "${key}" "${value}"`);

			let result = this.executeShellCommand(broadcastCommand).wait();
			this.$logger.trace(`Broadcast result ${result} from ${broadcastCommand}`);
			
			let match = result.match(/Broadcast completed: result=(\d+)/);
			if (match) {
				return +match[1];
			}

			this.$errors.failWithoutHelp("Unable to broadcast to android device:\n%s", result);
		}).future<number>()();
	}
	
	private composeCommand(args: string[]): IFuture<string> {
		return (() => {
			let command = util.format.apply(null, args);
			let result = `"${this.$staticConfig.getAdbFilePath().wait()}" -s ${this.identifier} ${command}`;
			return result;
		}).future<string>()();
	}
}