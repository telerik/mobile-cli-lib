///<reference path="../.d.ts"/>

import Future = require("fibers/future");
import child_process = require("child_process");
import util = require("util");

export class ChildProcess implements IChildProcess {
	constructor(private $logger: ILogger) {}

	private _execFile = Future.wrap((command: string, args: string[], callback: (error: any, stdout: NodeBuffer) => void) => {
		return child_process.execFile(command, args, callback);
	});

	public exec(command: string): IFuture<any> {
		var future = new Future<any>();
		child_process.exec(command, (error: Error, stdout: NodeBuffer, stderr: NodeBuffer) => {
			this.$logger.trace("Exec %s \n stdout: %s \n stderr: %s", command, stdout.toString(), stderr.toString());

			if(error) {
				future.throw(error);
			} else {
				future.return(stdout);
			}
		});

		return future;
	}

	public execFile(command: string, args: string[]): IFuture<any> {
		this.$logger.debug("execFile: %s", command);
		args.forEach(a => this.$logger.debug("    %s", a));
		return this._execFile(command, args);
	}

	public spawn(command: string, args?: string[], options?: any): any {
		return child_process.spawn(command, args, options);
	}

	public spawnFromEvent(command: string, args: string[], event: string, options?: any): IFuture<void> { // event should be exit or close
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