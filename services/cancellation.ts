///<reference path="../../.d.ts"/>
"use strict";

import watchr = require("watchr");
import path = require("path");
import os = require("os");
var options: any = require("../options");
import Future = require("fibers/future");

export class CancellationService implements ICancellationService {
	private watches: IDictionary<watchr.IWatcherInstance> = {};

	constructor(private $fs: IFileSystem,
				private $logger: ILogger,
				private $errors: IErrors) {
		this.$fs.createDirectory(CancellationService.killSwitchDir).wait();
		this.$fs.chmod(CancellationService.killSwitchDir, "0777").wait();
	}

	public begin(name: string): IFuture<void> {
		return (() => {
			var triggerFile = CancellationService.makeKillSwitchFileName(name);

			var stream = this.$fs.createWriteStream(triggerFile);
			var streamEnd = this.$fs.futureFromEvent(stream, "finish");
			stream.end();
			streamEnd.wait();
			this.$fs.chmod(triggerFile, "0777").wait();

			this.$logger.trace("Starting watch on killswitch %s", triggerFile);
			var watcherInitialized = new Future<watchr.IWatcherInstance>();
			watchr.watch({
				path: triggerFile,
				listeners: {
					error: (error: Error) => {
						this.$errors.fail(error);
					},
					change: (changeType: string, filePath: string) => {
						if (changeType === "delete") {
							process.exit();
						}
					}
				},
				next: (err: Error, _watcherInstance: any) => {
					var watcherInstance: watchr.IWatcherInstance = _watcherInstance;
					if (err) {
						watcherInitialized.throw(err);
					} else {
						watcherInitialized.return(watcherInstance);
					}
				}
			});

			var watcher = watcherInitialized.wait();

			if (watcher) {
				this.watches[name] = watcher;
			}
		}).future<void>()();
	}

	public end(name: string): void {
		var watcher = this.watches[name];
		delete this.watches[name];
		watcher.close();
	}

	public dispose(): void {
		Object.keys(this.watches).forEach((name) => {
			this.end(name);
		})
	}

	private static get killSwitchDir(): string {
		return path.join(os.tmpDir(), process.env.SUDO_USER || process.env.USER || process.env.USERNAME,  "KillSwitches");
	}

	private static makeKillSwitchFileName(name: string): string {
		return path.join(CancellationService.killSwitchDir, name);
	}
}
$injector.register("cancellation", CancellationService);