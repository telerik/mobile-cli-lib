import Future = require("fibers/future");

export class NpmPluginsSource implements IPluginsSource {
	private _plugins: IBasicPluginInformation[];

	constructor(private $childProcess: IChildProcess,
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

			let searchParams = ["search"].concat(keywords);

			// TODO: get npm binary from npmService.
			let npmCommand = this.$hostInfo.isWindows ? "npm.cmd" : "npm";

			let npmFuture = this.$childProcess.spawnFromEvent(npmCommand, searchParams, "close");

			this.$logger.printInfoMessageOnSameLine("Searching for plugins in npm, please wait.");

			this.$progressIndicator.showProgressIndicator(npmFuture, 2000).wait();

			let npmSearchResult = npmFuture.get();

			if (npmSearchResult.stderr) {
				// npm will write "npm WARN Building the local index for the first time, please be patient" to the stderr and if it is the only message on the stderr we should ignore it.
				let splitError = npmSearchResult.stderr.split("\n");
				if (splitError.length > 2 || splitError[0].indexOf("Building the local index for the first time") === -1) {
					this.$errors.failWithoutHelp(npmSearchResult.stderr);
				}
			}

			// Need to split the result only by \n because the npm result contains only \n and on Windows it will not split correctly when using EOL.
			// Sample output:
			// NAME                    DESCRIPTION             AUTHOR        DATE       VERSION  KEYWORDS
			// cordova-plugin-console  Cordova Console Plugin  =csantanapr…  2016-04-20 1.0.3    cordova console ecosystem:cordova cordova-ios
			let pluginsRows: string[] = npmSearchResult.stdout.split("\n");

			// Remove the table headers row.
			pluginsRows.shift();

			let npmNameGroup = "(\\S+)";
			let npmDateGroup = "(\\d+\\-\\d+\\-\\d+)\\s";
			let npmFreeTextGroup = "([^=]+)";
			let npmAuthorsGroup = "((?:=\\S+\\s?)+)\\s+";

			// Should look like this /(\S+)\s+([^=]+)((?:=\S+\s?)+)\s+(\d+\-\d+\-\d+)\s(\S+)(\s+([^=]+))?/
			let pluginRowRegExp = new RegExp(`${npmNameGroup}\\s+${npmFreeTextGroup}${npmAuthorsGroup}${npmDateGroup}${npmNameGroup}(\\s+${npmFreeTextGroup})?`);

			_.each(pluginsRows, (pluginRow: string) => {
				let matches = pluginRowRegExp.exec(pluginRow.trim());

				if (!matches || !matches[0]) {
					return;
				}

				this._plugins.push({
					name: matches[1],
					description: matches[2],
					version: matches[5]
				});
			});
		}).future<void>()();
	}

	public getPlugins(page: number, count: number): IFuture<IBasicPluginInformation[]> {
		return ((): IBasicPluginInformation[] => {
			let result: IBasicPluginInformation[] = [];
			let skip = page * count;

			result = _.slice(this._plugins, skip, skip + count);

			return result;
		}).future<IBasicPluginInformation[]>()();
	}

	public getAllPlugins(): IFuture<IBasicPluginInformation[]> {
		return Future.fromResult(this._plugins);
	}

	public hasPlugins(): boolean {
		return !!(this._plugins && this._plugins.length);
	}
}

$injector.register("npmPluginsSource", NpmPluginsSource);
