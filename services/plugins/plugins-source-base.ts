import Future = require("fibers/future");

export abstract class PluginsSourceBase implements IPluginsSource {
	protected progressIndicatorMessage: string;
	protected projectDir: string;
	protected plugins: IBasicPluginInformation[];

	private _isInitialized: boolean;

	constructor(protected $progressIndicator: IProgressIndicator,
		protected $logger: ILogger) { }

	public async initialize(projectDir: string, keywords: string[]): Promise<void> {
			if (this._isInitialized) {
				return;
			}

			this.plugins = [];
			this.projectDir = projectDir;
			this._isInitialized = true;

			this.$logger.printInfoMessageOnSameLine(this.progressIndicatorMessage);
			this.$progressIndicator.showProgressIndicator(this.initializeCore(projectDir, keywords), 2000).wait();
	}

	public hasPlugins(): boolean {
		return !!(this.plugins && this.plugins.length);
	}

	public getAllPlugins(): IFuture<IBasicPluginInformation[]> {
		return Future.fromResult(this.plugins);
	}

	public abstract getPlugins(page: number, count: number): IFuture<IBasicPluginInformation[]>;

	protected abstract initializeCore(projectDir: string, keywords: string[]): IFuture<void>;
}
