interface ICommandsService {
	allCommands(includeDev: boolean): string[];
	tryExecuteCommand(commandName: string, commandArguments: string[]): IFuture<void>;
	executeCommandUnchecked(commandName: string, commandArguments: string[]): IFuture<boolean>;
	completeCommand(): IFuture<boolean>;
}