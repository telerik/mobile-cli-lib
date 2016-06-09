import * as path from "path";

export class PreUninstallCommand implements ICommand {

	constructor(private $fs: IFileSystem,
		private $childProcess: IChildProcess,
		private $logger: ILogger,
		private $options: ICommonOptions) { }
	public disableAnalytics = true;

	public allowedParameters: ICommandParameter[] = [];

	public execute(args: string[]): IFuture<void> {
		return (() => {
			this.$fs.deleteFile(path.join(this.$options.profileDir, "KillSwitches", "cli")).wait();
		}).future<void>()();
	}
}
$injector.registerCommand("dev-preuninstall", PreUninstallCommand);
