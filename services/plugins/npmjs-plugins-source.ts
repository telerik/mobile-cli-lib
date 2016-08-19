import * as parse5 from "parse5";
import {PluginsSourceBase} from "./plugins-source-base";

export class NpmjsPluginsSource extends PluginsSourceBase implements IPluginsSource {
	private static NPMJS_ADDRESS = "http://npmjs.org";

	private _keywords: string[];
	private _pages: IBasicPluginInformation[][];

	constructor(private $httpClient: Server.IHttpClient,
		private $childProcess: IChildProcess,
		private $hostInfo: IHostInfo,
		private $progressIndicator: IProgressIndicator,
		private $logger: ILogger,
		private $errors: IErrors) {
		super();
		this._pages = [];
	}

	public initialize(projectDir: string, keywords: string[]): IFuture<void> {
		return (() => {
			super.initialize(projectDir, keywords).wait();

			this._keywords = keywords;

			this._plugins = this.getPluginsFromNpmjs(keywords, 1).wait();
		}).future<void>()();
	}

	public getPlugins(page: number, count: number): IFuture<IBasicPluginInformation[]> {
		return ((): IBasicPluginInformation[] => {
			let loadedPlugins = this._pages[page];
			if (loadedPlugins) {
				return loadedPlugins;
			}

			let result = this.getPluginsFromNpmjs(this._keywords, page).wait();

			this._pages[page] = result;

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

	private getPluginsFromNpmjs(keywords: string[], page: number): IFuture<IBasicPluginInformation[]> {
		return ((): IBasicPluginInformation[] => {
			let pluginName = encodeURIComponent(keywords.join(" "));
			let url = `${NpmjsPluginsSource.NPMJS_ADDRESS}/search?q=${pluginName}&page=${page}`;

			try {
				let responseBody: string = this.$httpClient.httpRequest(url).wait().body;

				let document = parse5.parse(responseBody);
				let html = _.find(document.childNodes, (node: parse5.ASTNode) => node.nodeName === "html");

				let resultsContainer = this.findNodeByClass(html, "search-results");
				if (!resultsContainer || !resultsContainer.childNodes) {
					return null;
				}

				let resultsElements = _.filter(resultsContainer.childNodes, (node: parse5.ASTNode) => node.nodeName === "li");
				return _.map(resultsElements, (node: parse5.ASTNode) => this.getPluginInfo(node));
			} catch (err) {
				this.$logger.trace(`Error while getting information for ${keywords} from http://npmjs.org - ${err}`);
				return null;
			}
		}).future<IBasicPluginInformation[]>()();
	}

	private getPluginInfo(node: parse5.ASTNode): IBasicPluginInformation {
		let name = this.getTextFromElementWithClass(node, "name");
		let version = this.getTextFromElementWithClass(node, "version");
		let description = this.getTextFromElementWithClass(node, "description");
		let author = this.getTextFromElementWithClass(node, "author");

		return {
			name,
			version,
			description,
			author
		};
	}

	private findNodeByClass(parent: parse5.ASTNode, className: string): parse5.ASTNode {
		if (!parent.childNodes || parent.childNodes.length === 0) {
			return null;
		}

		for (let i = 0; i < parent.childNodes.length; i++) {
			let node = parent.childNodes[i];

			if (_.some(node.attrs, (attr: parse5.ASTAttribute) => attr.name === "class" && attr.value === className)) {
				return node;
			} else {
				let result = this.findNodeByClass(node, className);

				if (result) {
					return result;
				}
			}
		}
	}

	private getTextFromElementWithClass(node: parse5.ASTNode, className: string): string {
		let element = this.findNodeByClass(node, className);

		if (element && element.childNodes) {
			let textElement = _.find(element.childNodes, (child: parse5.ASTNode) => child.nodeName === "#text");
			if (textElement) {
				return textElement.value;
			}
		}

		return null;
	}
}

$injector.register("npmjsPluginsSource", NpmjsPluginsSource);
