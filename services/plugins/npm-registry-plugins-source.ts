import {PluginsSourceBase} from "./plugins-source-base";
import Future = require("fibers/future");

export class NpmRegistryPluginsSource extends PluginsSourceBase implements IPluginsSource {
	private _hasReturnedPlugin: boolean;

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
		if (!this._hasReturnedPlugin) {
			this._hasReturnedPlugin = true;
			return Future.fromResult(this._plugins);
		} else {
			return Future.fromResult(null);
		}
	}

	public getAllPlugins(): IFuture<IBasicPluginInformation[]> {
		return Future.fromResult(this._plugins);
	}

	private prepareScopedPluginName(plugin: string): string {
		let pluginName = plugin.replace("/", "%2F");

		return pluginName;
	}

	private getPluginFromNpmRegistry(plugin: string): IFuture<IBasicPluginInformation> {
		return ((): IBasicPluginInformation => {
			let pluginName = this.$npmService.isScopedDependency(plugin) ? this.prepareScopedPluginName(plugin) : plugin;
			return this.$npmService.getPackageJsonFromNpmRegistry(pluginName).wait();
		}).future<IBasicPluginInformation>()();
	}
}

$injector.register("npmRegistryPluginsSource", NpmRegistryPluginsSource);
