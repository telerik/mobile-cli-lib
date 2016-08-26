import {NpmPluginsSource} from "./npm-plugins-source";
import {NpmRegistryPluginsSource} from "./npm-registry-plugins-source";
import {NpmjsPluginsSource} from "./npmjs-plugins-source";

export class NpmPluginsService implements INpmPluginsService {
	constructor(private $injector: IInjector) { }

	public search(projectDir: string, keywords: string[], modifySearchQuery: (keywords: string[]) => string[]): IFuture<IPluginsSource> {
		return ((): IPluginsSource => {
			let query = modifySearchQuery ? modifySearchQuery(keywords) : keywords;

			let pluginsSource = this.searchCore(NpmjsPluginsSource, projectDir, keywords).wait() ||
				this.searchCore(NpmRegistryPluginsSource, projectDir, keywords).wait() ||
				this.preparePluginsSource(NpmPluginsSource, projectDir, query).wait();

			return pluginsSource;
		}).future<IPluginsSource>()();
	}

	public optimizedSearch(projectDir: string, keywords: string[], modifySearchQuery: (keywords: string[]) => string[]): IFuture<IPluginsSource> {
		return ((): IPluginsSource => {
			return this.searchCore(NpmRegistryPluginsSource, projectDir, keywords).wait() || this.search(projectDir, keywords, modifySearchQuery).wait();
		}).future<IPluginsSource>()();
	}

	private searchCore(pluginsSourceConstructor: Function, projectDir: string, keywords: string[]): IFuture<IPluginsSource> {
		return (() => {
			let npmPluginsSource = this.preparePluginsSource(pluginsSourceConstructor, projectDir, keywords).wait();

			return npmPluginsSource.hasPlugins() ? npmPluginsSource : null;
		}).future<IPluginsSource>()();
	}

	private preparePluginsSource(pluginsSourceConstructor: Function, projectDir: string, keywords: string[]): IFuture<IPluginsSource> {
		return ((): IPluginsSource => {
			let pluginsSource: IPluginsSource = this.$injector.resolve(pluginsSourceConstructor, { projectDir, keywords });
			pluginsSource.initialize(projectDir, keywords).wait();
			return pluginsSource;
		}).future<IPluginsSource>()();
	}
}

$injector.register("npmPluginsService", NpmPluginsService);
