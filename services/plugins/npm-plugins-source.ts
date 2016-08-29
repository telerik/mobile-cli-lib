import {PluginsSourceBase} from "./plugins-source-base";
import Future = require("fibers/future");

export class NpmPluginsSource extends PluginsSourceBase implements IPluginsSource {
	constructor($progressIndicator: IProgressIndicator,
		$logger: ILogger,
		private $childProcess: IChildProcess,
		private $hostInfo: IHostInfo,
		private $npmService: INpmService,
		private $errors: IErrors) {
		super($progressIndicator, $logger);
	}

	protected get progressIndicatorMessage(): string {
		return "Searching for plugins with npm search command.";
	}

	public getPlugins(page: number, count: number): IFuture<IBasicPluginInformation[]> {
		let skip = page * count;

		return Future.fromResult(_.slice(this.plugins, skip, skip + count));
	}

	protected initializeCore(projectDir: string, keywords: string[]): IFuture<void> {
		return (() => {
			this.plugins = this.$npmService.search(this.projectDir, keywords).wait();
		}).future<void>()();
	}
}
