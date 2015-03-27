interface ICommandsService {
	allCommands(includeDev: boolean): string[];
	tryExecuteCommand(commandName: string, commandArguments: string[]): IFuture<void>;
	executeCommandUnchecked(commandName: string, commandArguments: string[]): IFuture<boolean>;
	completeCommand(): IFuture<boolean>;
}

interface ICommandsServiceProvider {
	getDynamicCommands(): IFuture<string[]>;
	generateDynamicCommands(): IFuture<void>;
	registerDynamicSubCommands(): void;
}