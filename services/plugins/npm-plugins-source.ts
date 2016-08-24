import {PluginsSourceBase} from "./plugins-source-base";
import Future = require("fibers/future");

export class NpmPluginsSource extends PluginsSourceBase implements IPluginsSource {
	constructor(private $childProcess: IChildProcess,
		private $hostInfo: IHostInfo,
		private $npmService: INpmService,
		private $logger: ILogger,
		private $errors: IErrors) {
		super();
	}

	public initialize(projectDir: string, keywords: string[]): IFuture<void> {
		return (() => {
			super.initialize(projectDir, keywords).wait();

			this._plugins = this.$npmService.search(this._projectDir, keywords).wait();
		}).future<void>()();
	}

	public getPlugins(page: number, count: number): IFuture<IBasicPluginInformation[]> {
		let skip = page * count;

		return Future.fromResult(_.slice(this._plugins, skip, skip + count));
	}
}
