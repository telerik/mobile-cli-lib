import {PluginsSourceBase} from "./plugins-source-base";
import Future = require("fibers/future");

export class NpmPluginsSource extends PluginsSourceBase implements IPluginsSource {
	constructor(private $childProcess: IChildProcess,
		private $hostInfo: IHostInfo,
		private $npmService: INpmService,
		private $progressIndicator: IProgressIndicator,
		private $logger: ILogger,
		private $errors: IErrors) {
		super();
	}

	public initialize(projectDir: string, keywords: string[]): IFuture<void> {
		return (() => {
			super.initialize(projectDir, keywords).wait();

			let searchFuture = this.$npmService.search(this._projectDir, keywords);

			this.$logger.printInfoMessageOnSameLine("Searching for plugins in npm, please wait.");

			this.$progressIndicator.showProgressIndicator(searchFuture, 2000).wait();

			this._plugins = searchFuture.get();
		}).future<void>()();
	}

	public getPlugins(page: number, count: number): IFuture<IBasicPluginInformation[]> {
		let skip = page * count;

		return Future.fromResult(_.slice(this._plugins, skip, skip + count));
	}
}

$injector.register("npmPluginsSource", NpmPluginsSource);
