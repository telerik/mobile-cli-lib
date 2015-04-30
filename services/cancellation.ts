///<reference path="../../.d.ts"/>
"use strict";

let gaze = require("gaze");
import path = require("path");
import os = require("os");
import Future = require("fibers/future");
let hostInfo = $injector.resolve("hostInfo");

class CancellationService implements ICancellationService {
	private watches: IDictionary<IWatcherInstance> = {};

	constructor(private $fs: IFileSystem,
			private $logger: ILogger) {
		this.$fs.createDirectory(CancellationService.killSwitchDir).wait();
		this.$fs.chmod(CancellationService.killSwitchDir, "0777").wait();
	}

	public begin(name: string): IFuture<void> {
		return (() => {
			let triggerFile = CancellationService.makeKillSwitchFileName(name);

			let stream = this.$fs.createWriteStream(triggerFile);
			let streamEnd = this.$fs.futureFromEvent(stream, "finish");
			stream.end();
			streamEnd.wait();
			this.$fs.chmod(triggerFile, "0777").wait();

			this.$logger.trace("Starting watch on killswitch %s", triggerFile);

			let watcherInitialized = new Future<IWatcherInstance>();

			gaze(triggerFile, function(err: any, watcher: any) {
				this.on("deleted", (filePath: string) => process.exit());
				if(err) {
					watcherInitialized.throw(err);
				} else {
					watcherInitialized.return(watcher);
				}
			});

			let watcher = watcherInitialized.wait();

			if (watcher) {
				this.watches[name] = watcher;
			}
		}).future<void>()();
	}

	public end(name: string): void {
		let watcher = this.watches[name];
		delete this.watches[name];
		watcher.close();
	}

	public dispose(): void {
		_(this.watches).keys().each(name => this.end(name)).value();
	}

	private static get killSwitchDir(): string {
		return path.join(os.tmpdir(), process.env.SUDO_USER || process.env.USER || process.env.USERNAME, "KillSwitches");
	}

	private static makeKillSwitchFileName(name: string): string {
		return path.join(CancellationService.killSwitchDir, name);
	}
}

class CancellationServiceDummy implements ICancellationService {
	dispose():void {
	}

	begin(name:string):IFuture<void> {
		return Future.fromResult();
	}

	end(name:string):void {
	}
}

if (hostInfo.isWindows) {
	$injector.register("cancellation", CancellationService);
} else {
	$injector.register("cancellation", CancellationServiceDummy);
}
