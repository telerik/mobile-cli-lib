import {EOL} from "os";
import Future = require("fibers/future");

export class HelpCommand implements ICommand {
	constructor(private $logger: ILogger,
		private $injector: IInjector,
		private $htmlHelpService: IHtmlHelpService,
		private $staticConfig: Config.IStaticConfig,
		private $options: ICommonOptions) { }

	public enableHooks = false;
	public async canExecute(args: string[]): Promise<boolean> {
		return Promise.resolve(true);
	}

	public allowedParameters: ICommandParameter[] = [];

	public async execute(args: string[]): Promise<void> {
			let topic = (args[0] || "").toLowerCase();
			let hierarchicalCommand = this.$injector.buildHierarchicalCommand(args[0], _.tail(args));
			if (hierarchicalCommand) {
				topic = hierarchicalCommand.commandName;
			}

			if (this.$options.help) {
				let help = this.$htmlHelpService.getCommandLineHelpForCommand(topic);
				if (this.$staticConfig.FULL_CLIENT_NAME) {
					this.$logger.info(this.$staticConfig.FULL_CLIENT_NAME.green.bold + EOL);
				}

				this.$logger.printMarkdown(help);
			} else {
				await this.$htmlHelpService.openHelpForCommandInBrowser(topic);
			}
	}
}

$injector.registerCommand(["help", "/?"], HelpCommand);
