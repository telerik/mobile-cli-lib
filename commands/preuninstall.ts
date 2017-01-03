import * as path from "path";

export class PreUninstallCommand implements ICommand {
	constructor(private $fs: IFileSystem,
		private $childProcess: IChildProcess,
		private $logger: ILogger,
		private $options: ICommonOptions) { }
	public disableAnalytics = true;

	public allowedParameters: ICommandParameter[] = [];

	public async execute(args: string[]): Promise<void> {
		this.$fs.deleteFile(path.join(this.$options.profileDir, "KillSwitches", "cli"));
	}
}
$injector.registerCommand("dev-preuninstall", PreUninstallCommand);
