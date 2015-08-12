///<reference path=".d.ts"/>
"use strict";

import Future = require("fibers/future");
import * as child_process from "child_process";
import * as util from "util";

export class ChildProcess implements IChildProcess {
	constructor(private $logger: ILogger,
		private $errors: IErrors) {}

	public exec(command: string, options?: any): IFuture<any> {
		let future = new Future<any>();
		let callback = (error: Error, stdout: NodeBuffer, stderr: NodeBuffer) => {
			this.$logger.trace("Exec %s \n stdout: %s \n stderr: %s", command, stdout.toString(), stderr.toString());

			if(error) {
				future.throw(error);
			} else {
				future.return(stdout);
			}
		};

		if (options) {
			child_process.exec(command, options, callback);
		} else {
			child_process.exec(command, callback);
		}

		return future;
	}

	public execFile(command: string, args: string[]): IFuture<any> {
		this.$logger.debug("execFile: %s %s", command, args.join(" "));
		let future = new Future<any>();
		let result = child_process.execFile(command, args, (error: any, stdout: NodeBuffer) => {
			if(error) {
				future.throw(error);
			} else {
				future.return(stdout);
			}
		});

		return future;
	}

	public spawn(command: string, args?: string[], options?: any): child_process.ChildProcess {
		this.$logger.debug("spawn: %s %s", command, args.join(" "));
		return child_process.spawn(command, args, options);
	}

	public spawnFromEvent(command: string, args: string[], event: string, options?: any, spawnFromEventOptions?: ISpawnFromEventOptions): IFuture<ISpawnResult> { // event should be exit or close
		let future = new Future<ISpawnResult>();
		let childProcess = this.spawn(command, args, options);

		let capturedOut = '';
		let capturedErr = '';

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
			let exitCode = typeof arg === 'number' ? arg : arg && arg.code;
			let result = {
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
					let errorMessage = util.format('Command %s failed with exit code %d', command, exitCode);
					if (capturedErr) {
						errorMessage += util.format(' Error output: \n %s', capturedErr);
					}

					if(!future.isResolved()) {
						future.throw(new Error(errorMessage));
					}
				}
			}
		});

		childProcess.once("error", (err: Error) => {
			if(!future.isResolved()) {
				future.throw(err);
			}
		});

		return future;
	}

	public tryExecuteApplication(command: string, args: string[], event: string, errorMessage: string, condition: (childProcess: any) => boolean): IFuture<any> {
		return (() => {
			let childProcess = this.tryExecuteApplicationCore(command, args, event, errorMessage).wait();

			if(condition && condition(childProcess)) {
				this.$errors.fail(errorMessage);
			}
		}).future<void>()();
	}

	private tryExecuteApplicationCore(command: string, args: string[], event: string, errorMessage: string): IFuture<any> {
		try {
			return this.spawnFromEvent(command, args, event, undefined, { throwError: false });
		} catch(e) {
			let message = (e.code === "ENOENT") ? errorMessage : e.message;
			this.$errors.failWithoutHelp(message);
		}
	}
}
$injector.register("childProcess", ChildProcess);
