import * as queue from "./queue";
import * as path from "path";

export class CommandDispatcher implements ICommandDispatcher {
	constructor(private $logger: ILogger,
		private $cancellation: ICancellationService,
		private $commandsService: ICommandsService,
		private $staticConfig: Config.IStaticConfig,
		private $sysInfo: ISysInfo,
		private $options: ICommonOptions,
		private $fs: IFileSystem) { }

	public async dispatchCommand(): Promise<void> {
			if (this.$options.version) {
				return this.printVersion();
			}

			if (this.$logger.getLevel() === "TRACE") {
				// CommandDispatcher is called from external CLI's only, so pass the path to their package.json
				let sysInfo = this.$sysInfo.getSysInfo(path.join(__dirname, "..", "..", "package.json")).wait();
				this.$logger.trace("System information:");
				this.$logger.trace(sysInfo);
			}

			let commandName = this.getCommandName();
			let commandArguments = this.$options.argv._.slice(1);
			let lastArgument: string = _.last(commandArguments);

			if(this.$options.help) {
				commandArguments.unshift(commandName);
				commandName = "help";
			} else if(lastArgument === "/?" || lastArgument === "?") {
				commandArguments.pop();
				commandArguments.unshift(commandName);
				commandName = "help";
			}

			this.$cancellation.begin("cli").wait();

			this.$commandsService.tryExecuteCommand(commandName, commandArguments).wait();
	}

	public completeCommand(): IFuture<boolean> {
		return this.$commandsService.completeCommand();
	}

	private getCommandName(): string {
		let remaining: string[] = this.$options.argv._;
		if (remaining.length > 0) {
			return remaining[0].toString().toLowerCase();
		}
		// if only <CLI_NAME> is specified on console, show console help
		this.$options.help = true;
		return "";
	}

	private printVersion(): void {
		let version = this.$staticConfig.version;

		let json = this.$fs.readJson(this.$staticConfig.pathToPackageJson);
		if(json && json.buildVersion) {
			version = `${version}-${json.buildVersion}`;
		}
		this.$logger.out(version);
	}
}
$injector.register("commandDispatcher", CommandDispatcher);

class FutureDispatcher implements IFutureDispatcher {
	private actions: IQueue<any>;

	public constructor(private $errors: IErrors) { }

	public run(): void {
		if (this.actions) {
			this.$errors.fail("You cannot run a running future dispatcher.");
		}
		this.actions = new queue.Queue<any>();

		while(true) {
			let action = this.actions.dequeue().wait();
			action().wait();
		}
	}

	public dispatch(action: () => IFuture<void>) {
		this.actions.enqueue(action);
	}
}
$injector.register("dispatcher", FutureDispatcher, false);
