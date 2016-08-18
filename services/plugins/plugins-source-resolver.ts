export class PluginsSourceResolver implements IPluginsSourceResolver {
	constructor(private $npmPluginsSource: IPluginsSource,
		private $npmjsPluginsSource: IPluginsSource,
		private $npmRegistryPluginsSource: IPluginsSource) { }

	public resolveNpmPluginsSource(projectDir: string, keywords: string[]): IFuture<IPluginsSource> {
		return this.preparePluginsSource(this.$npmPluginsSource, projectDir, keywords);
	}

	public resolveNpmjsPluginsSource(projectDir: string, keywords: string[]): IFuture<IPluginsSource> {
		return this.preparePluginsSource(this.$npmjsPluginsSource, projectDir, keywords);
	}

	public resolveNpmRegistryPluginsSource(projectDir: string, keywords: string[]): IFuture<IPluginsSource> {
		return this.preparePluginsSource(this.$npmRegistryPluginsSource, projectDir, keywords);
	}

	private preparePluginsSource(pluginsSource: IPluginsSource, projectDir: string, keywords: string[]): IFuture<IPluginsSource> {
		return ((): IPluginsSource => {
			pluginsSource.initialize(projectDir, keywords).wait();
			return pluginsSource;
		}).future<IPluginsSource>()();
	}
}

$injector.register("pluginsSourceResolver", PluginsSourceResolver);
