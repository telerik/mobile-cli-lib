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

	public async getPlugins(page: number, count: number): Promise<IBasicPluginInformation[]> {
		let skip = page * count;

		return Promise.resolve(_.slice(this.plugins, skip, skip + count));
	}

	protected async initializeCore(projectDir: string, keywords: string[]): Promise<void> {
			this.plugins = await  this.$npmService.search(this.projectDir, keywords);
	}
}
