import * as path from "path";

export class NpmService implements INpmService {
	private static NPM_MODULE_NAME = "npm";

	private _npmExecutableName: string;
	private _npmBinary: string;

	constructor(private $hostInfo: IHostInfo,
		private $childProcess: IChildProcess) { }

	private get npmBinary(): string {
		if (!this._npmBinary) {
			try {
				require(NpmService.NPM_MODULE_NAME);
				let npmMainJsFile = require.resolve(NpmService.NPM_MODULE_NAME);
				let nodeModulesDirName = "node_modules";
				this._npmBinary = path.join(npmMainJsFile.substring(0, npmMainJsFile.lastIndexOf(nodeModulesDirName) + nodeModulesDirName.length), ".bin", this.npmExecutableName);
			} catch (err) {
				this._npmBinary = this.npmExecutableName;
			}
		}

		return this._npmBinary;
	}

	private get npmExecutableName(): string {
		if (!this._npmExecutableName) {
			this._npmExecutableName = "npm";

			if (this.$hostInfo.isWindows) {
				this._npmExecutableName += ".cmd";
			}
		}

		return this._npmExecutableName;
	}

	public installPlugin(pluginName: string, args?: string[], directoryToInstall?: string): IFuture<any> {
		args = args || [];

		if (directoryToInstall) {
			args = _.concat(args, ["--prefix", directoryToInstall]);
		}

		args = _.concat(["install", pluginName], args);

		return this.$childProcess.spawnFromEvent(this.npmBinary, args, "close");
	}
}

$injector.register("npmService", NpmService);
