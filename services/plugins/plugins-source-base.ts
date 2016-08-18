export abstract class PluginsSourceBase implements IPluginsSource {
	protected _projectDir: string;
	protected _plugins: IBasicPluginInformation[];

	private _isInitialized: boolean;

	public initialize(projectDir: string, keywords: string[]): IFuture<void> {
		return (() => {
			if (this._isInitialized) {
				return;
			}

			this._plugins = [];
			this._projectDir = projectDir;
			this._isInitialized = true;
		}).future<void>()();
	}

	public hasPlugins(): boolean {
		return !!(this._plugins && this._plugins.length);
	}

	public abstract getPlugins(page: number, count: number): IFuture<IBasicPluginInformation[]>;

	public abstract getAllPlugins(): IFuture<IBasicPluginInformation[]>;
}
