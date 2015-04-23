interface ICommandsService {
	allCommands(opts: {includeDevCommands: boolean}): string[];
	tryExecuteCommand(commandName: string, commandArguments: string[]): IFuture<void>;
	executeCommandUnchecked(commandName: string, commandArguments: string[]): IFuture<boolean>;
	completeCommand(): IFuture<boolean>;
}

interface ICommandsServiceProvider {
	dynamicCommandsPrefix: string;
	getDynamicCommands(): IFuture<string[]>;
	generateDynamicCommands(): IFuture<void>;
	registerDynamicSubCommands(): void;
}