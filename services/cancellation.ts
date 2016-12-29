let gaze = require("gaze");
import * as path from "path";
import * as os from "os";
import Future = require("fibers/future");
let hostInfo: IHostInfo = $injector.resolve("hostInfo");

class CancellationService implements ICancellationService {
	private watches: IDictionary<IWatcherInstance> = {};

	constructor(private $fs: IFileSystem,
			private $logger: ILogger) {
		this.$fs.createDirectory(CancellationService.killSwitchDir);
		this.$fs.chmod(CancellationService.killSwitchDir, "0777");
	}

	public async begin(name: string): Promise<void> {
			let triggerFile = CancellationService.makeKillSwitchFileName(name);
			if(!this.$fs.exists(triggerFile)) {
				this.$fs.writeFile(triggerFile, "");

				if (!hostInfo.isWindows) {
				this.$fs.chmod(triggerFile, "0777");
			}
			}

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

			let watcher = await  watcherInitialized;

			if (watcher) {
				this.watches[name] = watcher;
			}
	}

	public end(name: string): void {
		let watcher = this.watches[name];
		delete this.watches[name];
		watcher.close();
	}

	public dispose(): void {
		_(this.watches).keys().each(name => this.end(name));
	}

	private static get killSwitchDir(): string {
        return path.join(os.tmpdir(), process.env.SUDO_USER || process.env.USER || process.env.USERNAME || '', "KillSwitches");
	}

	private static makeKillSwitchFileName(name: string): string {
		return path.join(CancellationService.killSwitchDir, name);
	}
}

class CancellationServiceDummy implements ICancellationService {
	dispose():void {
		/* intentionally left blank */
	}

	async begin(name:string):Promise<void> {
		return Promise.resolve();
	}

	end(name:string):void {
		/* intentionally left blank */
	}
}

if (hostInfo.isWindows) {
	$injector.register("cancellation", CancellationService);
} else {
	$injector.register("cancellation", CancellationServiceDummy);
}
