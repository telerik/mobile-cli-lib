///<reference path=".d.ts"/>
"use strict";

import Future = require("fibers/future");
import * as child_process from "child_process";

export class ChildProcess implements IChildProcess {
	constructor(private $logger: ILogger,
		private $errors: IErrors) {}

	public exec(command: string, options?: any, execOptions?: IExecOptions): IFuture<any> {
		let future = new Future<any>();
		let callback = (error: Error, stdout: NodeBuffer, stderr: NodeBuffer) => {
			this.$logger.trace("Exec %s \n stdout: %s \n stderr: %s", command, stdout.toString(), stderr.toString());

			if(error) {
				future.throw(error);
			} else {
				let output = execOptions && execOptions.showStderr ?  { stdout, stderr } : stdout;
				future.return(output);
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
		this.$logger.debug("execFile: %s %s", command, this.getArgumentsAsQuotedString(args));
		let future = new Future<any>();
		child_process.execFile(command, args, (error: any, stdout: NodeBuffer) => {
			if(error) {
				future.throw(error);
			} else {
				future.return(stdout);
			}
		});

		return future;
	}

	public spawn(command: string, args?: string[], options?: any): child_process.ChildProcess {
		this.$logger.debug("spawn: %s %s", command, this.getArgumentsAsQuotedString(args));
		return child_process.spawn(command, args, options);
	}

	public fork(modulePath: string, args?: string[], options?: any): child_process.ChildProcess {
		this.$logger.debug("fork: %s %s", modulePath, this.getArgumentsAsQuotedString(args));
		return child_process.fork(modulePath, args, options);
	}

	public spawnFromEvent(command: string, args: string[], event: string,
			options?: any, spawnFromEventOptions?: ISpawnFromEventOptions): IFuture<ISpawnResult> { // event should be exit or close
		let future = new Future<ISpawnResult>();
		let childProcess = this.spawn(command, args, options);

		let capturedOut = "";
		let capturedErr = "";

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
			let exitCode = typeof arg === "number" ? arg : arg && arg.code;
			let result = {
				stdout: capturedOut,
				stderr: capturedErr,
				exitCode: exitCode
			};

			if(spawnFromEventOptions && spawnFromEventOptions.throwError === false) {
				if(!future.isResolved()) {
					this.$logger.trace("Result when throw error is false:");
					this.$logger.trace(result);
					future.return(result);
				}
			} else {
				if (exitCode === 0) {
					future.return(result);
				} else {
					let errorMessage = `Command ${command} failed with exit code ${exitCode}`;
					if (capturedErr) {
						errorMessage += ` Error output: \n ${capturedErr}`;
					}

					if(!future.isResolved()) {
						future.throw(new Error(errorMessage));
					}
				}
			}
		});

		childProcess.once("error", (err: Error) => {
			if(!future.isResolved()) {
				if(spawnFromEventOptions && spawnFromEventOptions.throwError === false) {
					let result = {
						stdout: capturedOut,
						stderr: err.message,
						exitCode: (<any>err).code
					};
					future.return(result);
				} else {
					future.throw(err);
				}
			}
		});

		return future;
	}

	public tryExecuteApplication(command: string, args: string[], event: string,
			errorMessage: string, condition: (_childProcess: any) => boolean): IFuture<any> {
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

	private getArgumentsAsQuotedString(args: string[]): string {
		return args.map(argument => `"${argument}"`).join(" ");
	}
}
$injector.register("childProcess", ChildProcess);
