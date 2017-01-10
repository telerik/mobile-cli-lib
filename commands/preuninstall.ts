import * as path from "path";

export class PreUninstallCommand implements ICommand {
	public disableAnalytics = true;

	public allowedParameters: ICommandParameter[] = [];

	constructor(private $fs: IFileSystem,
		private $options: ICommonOptions) { }

	public async execute(args: string[]): Promise<void> {
		this.$fs.deleteFile(path.join(this.$options.profileDir, "KillSwitches", "cli"));
	}
}

$injector.registerCommand("dev-preuninstall", PreUninstallCommand);
