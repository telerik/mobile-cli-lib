import { PluginsSourceBase } from "./plugins-source-base";

export class NpmRegistryPluginsSource extends PluginsSourceBase implements IPluginsSource {
	constructor($progressIndicator: IProgressIndicator,
		$logger: ILogger,
		private $httpClient: Server.IHttpClient,
		private $childProcess: IChildProcess,
		private $hostInfo: IHostInfo,
		private $npmService: INpmService,
		private $errors: IErrors) {
		super($progressIndicator, $logger);
	}

	protected get progressIndicatorMessage(): string {
		return "Searching for plugin in http://registry.npmjs.org.";
	}

	public async getPlugins(page: number, count: number): Promise<IBasicPluginInformation[]> {
		return Promise.resolve(page === 1 ? this.plugins : null);
	}

	protected async initializeCore(projectDir: string, keywords: string[]): Promise<void> {
		let plugin = await this.getPluginFromNpmRegistry(keywords[0]);
		this.plugins = plugin ? [plugin] : null;
	}

	private prepareScopedPluginName(plugin: string): string {
		return plugin.replace("/", "%2F");
	}

	private async getPluginFromNpmRegistry(plugin: string): Promise<IBasicPluginInformation> {
		let dependencyInfo = this.$npmService.getDependencyInformation(plugin);

		let pluginName = this.$npmService.isScopedDependency(plugin) ? this.prepareScopedPluginName(dependencyInfo.name) : dependencyInfo.name;

		let result = await this.$npmService.getPackageJsonFromNpmRegistry(pluginName, dependencyInfo.version);

		if (!result) {
			return null;
		}

		result.author = (result.author && result.author.name) || result.author;
		return result;
	}
}
