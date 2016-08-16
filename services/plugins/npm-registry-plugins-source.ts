import * as semver from "semver";
import Future = require("fibers/future");

export class NpmRegistryPluginsSource implements IPluginsSource {
	private static NPM_REGISTRY_ADDRESS = "http://registry.npmjs.org";

	private _hasReturnedPlugin: boolean;
	private _plugins: IBasicPluginInformation[];

	constructor(private $httpClient: Server.IHttpClient,
		private $childProcess: IChildProcess,
		private $hostInfo: IHostInfo,
		private $progressIndicator: IProgressIndicator,
		private $logger: ILogger,
		private $errors: IErrors) { }

	public initialize(keywords: string[]): IFuture<void> {
		return (() => {
			if (this._plugins && this._plugins.length) {
				return;
			}

			this._plugins = [this.getPluginFromNpmRegistry(keywords).wait()];
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

	public hasPlugins(): boolean {
		return !!(this._plugins && this._plugins.length);
	}

	private prepareScopedPluginName(keywords: string[]): string {
		let pluginName = keywords[0];

		pluginName = pluginName.replace("/", "%2F");

		return pluginName;
	}

	private getPluginFromNpmRegistry(keywords: string[]): IFuture<IBasicPluginInformation> {
		return ((): IBasicPluginInformation => {
			let pluginName = this.prepareScopedPluginName(keywords);
			let url = `${NpmRegistryPluginsSource.NPM_REGISTRY_ADDRESS}/${pluginName}`;

			try {
				let responseBody: any = JSON.parse(this.$httpClient.httpRequest(url).wait().body);

				let latestVersion = _(responseBody.versions)
					.keys()
					.sort((firstVersion: string, secondVersion: string) => semver.gt(firstVersion, secondVersion) ? -1 : 1)
					.first();

				let plugin = responseBody.versions[latestVersion];
				plugin.author = plugin.author.name;

				return plugin;
			} catch (err) {
				this.$logger.trace(`Error while getting information for ${keywords} from http://registry.npmjs.org - ${err}`);
				return null;
			}
		}).future<IBasicPluginInformation>()();
	}
}

$injector.register("npmRegistryPluginsSource", NpmRegistryPluginsSource);
