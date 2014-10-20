///<reference path="../.d.ts"/>

import Future = require("fibers/future");
import child_process = require("child_process");
import util = require("util");

export class ChildProcess implements IChildProcess {
	constructor(private $logger: ILogger) {}

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
		this.$logger.debug("execFile: %s %s", command, args.join(" "));
		var future = new Future<any>();
		var result = child_process.execFile(command, args, (error: any, stdout: NodeBuffer) => {
			if(error) {
				future.throw(error);
			} else {
				future.return(stdout);
			}
		});

		return future;
	}

	public spawn(command: string, args?: string[], options?: any): any {
		this.$logger.debug("spawn: %s %s", command, args.join(" "));
		return child_process.spawn(command, args, options);
	}

	public spawnFromEvent(command: string, args: string[], event: string, options?: any, spawnFromEventOptions?: ISpawnFromEventOptions): IFuture<ISpawnResult> { // event should be exit or close
		var future = new Future<ISpawnResult>();
		var childProcess = this.spawn(command, args, options);

		var capturedOut = '';
		var capturedErr = '';

		if(childProcess.stdout) {
			childProcess.stdout.on("data", (data: string) => {
				capturedOut += data;
			});
		}

		if(childProcess.stderr) {
			childProcess.stderr.on("data", (data: string) =>  {
				capturedErr += data;
			});
		}

		childProcess.on(event, (arg: any) => {
			var exitCode = typeof arg == 'number' ? arg : arg && arg.code;
			var result = {
				stdout: capturedOut,
				stderr: capturedErr,
				exitCode: exitCode
			};

			if(spawnFromEventOptions && spawnFromEventOptions.throwError === false) {
				future.return(result);
			} else {
				if (exitCode === 0) {
					future.return(result);
				} else {
					var errorMessage = util.format('Command %s failed with exit code %d', command, exitCode);
					if (capturedErr) {
						errorMessage += util.format(' Error output: \n %s', capturedErr);
					}
					future.throw(errorMessage);
				}
			}
		});

		return future;
	}
}
$injector.register("childProcess", ChildProcess);