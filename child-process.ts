///<reference path="../.d.ts"/>

import Future = require("fibers/future");
import child_process = require("child_process");
import util = require("util");

export class ChildProcess implements IChildProcess {
	constructor(private $logger: ILogger) {}

	private _exec = Future.wrap((command: string, callback: (error: any, stdout: NodeBuffer) => void) => {
		return child_process.exec(command, callback);
	});

	private _execFile = Future.wrap((command: string, args: string[], callback: (error: any, stdout: NodeBuffer) => void) => {
		return child_process.execFile(command, args, callback);
	});

	public exec(command: string): IFuture<any> {
		this.$logger.debug("exec: %s", command);
		return this._exec(command);
	}

	public execFile(command: string, args: string[]): IFuture<any> {
		this.$logger.debug("execFile: %s", command);
		args.forEach(a => this.$logger.debug("    %s", a));
		return this._execFile(command, args);
	}

	public spawn(command: string, args?: string[], options?: any): any {
		return child_process.spawn(command, args, options);
	}

	public superSpawn(command: string, args: string[], event: string, options?: any): IFuture<void> { // event should be exit or close
		var future = new Future<void>();
		var childProcess = this.spawn(command, args, options);
		childProcess.once(event, () => {
			var args = _.toArray(arguments);
			var statusCode = args[0];

			if(statusCode !== 0) {
				future.throw(util.format("Command %s exited with code %s", command, statusCode));
			} else {
				future.return();
			}
		});

		return future;
	}

}
$injector.register("childProcess", ChildProcess);