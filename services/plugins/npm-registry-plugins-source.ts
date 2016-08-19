import {PluginsSourceBase} from "./plugins-source-base";
import Future = require("fibers/future");

export class NpmRegistryPluginsSource extends PluginsSourceBase implements IPluginsSource {
	constructor(private $httpClient: Server.IHttpClient,
		private $childProcess: IChildProcess,
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

			this._plugins = [this.getPluginFromNpmRegistry(keywords[0]).wait()];
		}).future<void>()();
	}

	public getPlugins(page: number, count: number): IFuture<IBasicPluginInformation[]> {
		return page === 1 ? Future.fromResult(this._plugins) : Future.fromResult(null);
	}

	private prepareScopedPluginName(plugin: string): string {
		return plugin.replace("/", "%2F");
	}

	private getPluginFromNpmRegistry(plugin: string): IFuture<IBasicPluginInformation> {
		return ((): IBasicPluginInformation => {
			let pluginName = this.$npmService.isScopedDependency(plugin) ? this.prepareScopedPluginName(plugin) : plugin;
			let result = this.$npmService.getPackageJsonFromNpmRegistry(pluginName).wait();

			if (!result) {
				return null;
			}

			result.author = result.author.name || result.author;
			return result;
		}).future<IBasicPluginInformation>()();
	}
}

$injector.register("npmRegistryPluginsSource", NpmRegistryPluginsSource);
