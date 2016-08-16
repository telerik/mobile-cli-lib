import * as cheerio from "cheerio";

export class NpmjsPluginsSource implements IPluginsSource {
	private static NPMJS_ADDRESS = "http://npmjs.org";

	private _hasReturnedTheInitialPlugins: boolean;
	private _plugins: IBasicPluginInformation[];
	private _keywords: string[];

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

			this._plugins = [];
			this._keywords = keywords;

			this._plugins = this.getPluginsFromNpmjs(keywords, 0).wait();
		}).future<void>()();
	}

	public getPlugins(page: number, count: number): IFuture<IBasicPluginInformation[]> {
		return ((): IBasicPluginInformation[] => {
			if (!this._hasReturnedTheInitialPlugins && page === 0) {
				return this._plugins;
			}

			let result = this.getPluginsFromNpmjs(this._keywords, page).wait();

			this._plugins = this._plugins.concat(result);

			return result;
		}).future<IBasicPluginInformation[]>()();
	}

	public getAllPlugins(): IFuture<IBasicPluginInformation[]> {
		return ((): IBasicPluginInformation[] => {
			let result: IBasicPluginInformation[] = [];

			let currentPluginsFound: IBasicPluginInformation[] = [];
			let page = 0;

			do {
				currentPluginsFound = this.getPluginsFromNpmjs(this._keywords, page++).wait();
				if (currentPluginsFound && currentPluginsFound.length) {
					result = result.concat(currentPluginsFound);
				}
			} while (currentPluginsFound && currentPluginsFound.length);

			return result;
		}).future<IBasicPluginInformation[]>()();
	}

	public hasPlugins(): boolean {
		return !!(this._plugins && this._plugins.length);
	}

	private prepareScopedPluginName(keywords: string[]): string {
		let pluginName = keywords[0];

		pluginName = pluginName.replace("@", "%40");
		pluginName = pluginName.replace("/", "%2F");

		return pluginName;
	}

	private getPluginsFromNpmjs(keywords: string[], page: number): IFuture<IBasicPluginInformation[]> {
		return ((): IBasicPluginInformation[] => {
			let pluginName = this.prepareScopedPluginName(keywords);
			let url = `${NpmjsPluginsSource.NPMJS_ADDRESS}/search?q=${pluginName}&page=${page}`;

			try {
				let responseBody: string = this.$httpClient.httpRequest(url).wait().body;
				let $ = cheerio.load(responseBody);
				let searchResults = $(".search-results li");

				return this.getBasicPluginInfo($, searchResults);
			} catch (err) {
				this.$logger.trace(`Error while getting information for ${keywords} from http://npmjs.org - ${err}`);
				return null;
			}
		}).future<IBasicPluginInformation[]>()();
	}

	private getBasicPluginInfo($: CheerioStatic, elementsContainer: Cheerio): IBasicPluginInformation[] {
		let result: IBasicPluginInformation[] = [];
		elementsContainer.each((index: number, element: CheerioElement) => {
			let cheerioItem = $(element);
			let name = cheerioItem.find(".name").first().text();
			let author = cheerioItem.find(".author").first().text();
			let version = cheerioItem.find(".version").first().text();
			let description = cheerioItem.find(".description").first().text();

			result.push({
				name,
				version,
				description,
				author
			});
		});

		return result;
	}
}

$injector.register("npmjsPluginsSource", NpmjsPluginsSource);
