interface ICommandsService {
	allCommands(includeDev: boolean): string[];
	executeCommand(commandName: string, commandArguments: string[],  beforeExecuteCommandHook?: (command: ICommand, commandName: string) => void): boolean;
	tryExecuteCommand(commandName: string, commandArguments: string[], beforeExecuteCommandHook?: (command: ICommand, commandName: string) => void): void;
	executeCommandUnchecked(commandName: string, commandArguments: string[],  beforeExecuteCommandHook?: (command: ICommand, commandName: string) => void): boolean;
	completeCommand(propSchema?: any): IFuture<any>;
}