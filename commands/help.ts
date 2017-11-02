export class HelpCommand implements ICommand {
	constructor(private $injector: IInjector,
		private $helpService: IHelpService,
		private $options: ICommonOptions) { }

	public enableHooks = false;
	public async canExecute(args: string[]): Promise<boolean> {
		return true;
	}

	public allowedParameters: ICommandParameter[] = [];

	public async execute(args: string[]): Promise<void> {
		let topic = (args[0] || "").toLowerCase();
		const hierarchicalCommand = this.$injector.buildHierarchicalCommand(args[0], _.tail(args));
		if (hierarchicalCommand) {
			topic = hierarchicalCommand.commandName;
		}

		if (this.$options.help) {
			await this.$helpService.showCommandLineHelp(topic);
		} else {
			await this.$helpService.openHelpForCommandInBrowser(topic);
		}
	}
}

$injector.registerCommand(["help", "/?"], HelpCommand);
