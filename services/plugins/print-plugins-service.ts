import { createTable, isInteractive } from "../../helpers";

export class PrintPluginsService implements IPrintPluginsService {
	private static COUNT_OF_PLUGINS_TO_DISPLAY: number = 10;

	private _page: number;

	constructor(private $errors: IErrors,
		private $logger: ILogger,
		private $prompter: IPrompter) {
		this._page = 0;
	}

	public printPlugins(pluginsSource: IPluginsSource, options: IPrintPluginsOptions): IFuture<void> {
		return (() => {
			if (!pluginsSource.hasPlugins()) {
				this.$logger.warn("No plugins found.");
				return;
			}

			let count: number = options.count || PrintPluginsService.COUNT_OF_PLUGINS_TO_DISPLAY;

			if (!isInteractive() || options.showAllPlugins) {
				this.displayTableWithPlugins(pluginsSource.getAllPlugins().wait());
				return;
			}

			let pluginsToDisplay: IBasicPluginInformation[] = pluginsSource.getPlugins(this._page++, count).wait();
			let shouldDisplayMorePlugins: boolean = true;

			this.$logger.out("Available NativeScript plugins:");

			do {
				this.displayTableWithPlugins(pluginsToDisplay);

				shouldDisplayMorePlugins = this.$prompter.confirm("Load more plugins?").wait();

				pluginsToDisplay = pluginsSource.getPlugins(this._page++, count).wait();

				if (!pluginsToDisplay || pluginsToDisplay.length < 1) {
					return;
				}
			} while (shouldDisplayMorePlugins);
		}).future<void>()();
	}

	private displayTableWithPlugins(plugins: IBasicPluginInformation[]): void {
		let data: string[][] = [];
		data = this.createTableCells(plugins);

		let table: any = this.createPluginsTable(data);

		this.$logger.out(table.toString());
	}

	private createPluginsTable(data: string[][]): any {
		let headers: string[] = ["Plugin", "Version", "Author", "Description"];

		let table: any = createTable(headers, data);

		return table;
	}

	private createTableCells(plugins: IBasicPluginInformation[]): string[][] {
		return plugins.map((plugin: IBasicPluginInformation) => {
			return [plugin.name, plugin.version, plugin.author || "", plugin.description || ""];
		});
	}
}

$injector.register("printPluginsService", PrintPluginsService);
