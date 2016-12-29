import {NpmPluginsSource} from "./npm-plugins-source";
import {NpmRegistryPluginsSource} from "./npm-registry-plugins-source";
import {NpmjsPluginsSource} from "./npmjs-plugins-source";

export class NpmPluginsService implements INpmPluginsService {
	constructor(private $injector: IInjector) { }

	public async search(projectDir: string, keywords: string[], modifySearchQuery: (keywords: string[]) => string[]): Promise<IPluginsSource> {
			let query = modifySearchQuery ? modifySearchQuery(keywords) : keywords;

			let pluginsSource = await  this.searchCore(NpmjsPluginsSource, projectDir, keywords) ||
				this.searchCore(NpmRegistryPluginsSource, projectDir, keywords).wait() ||
				this.preparePluginsSource(NpmPluginsSource, projectDir, query).wait();

			return pluginsSource;
	}

	public async optimizedSearch(projectDir: string, keywords: string[], modifySearchQuery: (keywords: string[]) => string[]): Promise<IPluginsSource> {
			return this.searchCore(NpmRegistryPluginsSource, projectDir, keywords).wait() || await  this.search(projectDir, keywords, modifySearchQuery);
	}

	private async searchCore(pluginsSourceConstructor: Function, projectDir: string, keywords: string[]): Promise<IPluginsSource> {
			let npmPluginsSource = await  this.preparePluginsSource(pluginsSourceConstructor, projectDir, keywords);

			return npmPluginsSource.hasPlugins() ? npmPluginsSource : null;
	}

	private async preparePluginsSource(pluginsSourceConstructor: Function, projectDir: string, keywords: string[]): Promise<IPluginsSource> {
			let pluginsSource: IPluginsSource = this.$injector.resolve(pluginsSourceConstructor, { projectDir, keywords });
			pluginsSource.initialize(projectDir, keywords).wait();
			return pluginsSource;
	}
}

$injector.register("npmPluginsService", NpmPluginsService);
