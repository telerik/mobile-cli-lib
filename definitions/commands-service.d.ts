interface ICommandsService {
	allCommands(opts: {includeDevCommands: boolean}): string[];
	tryExecuteCommand(commandName: string, commandArguments: string[]): Promise<void>;
	executeCommandUnchecked(commandName: string, commandArguments: string[]): Promise<boolean>;
	completeCommand(): Promise<boolean>;
}

interface ICommandsServiceProvider {
	dynamicCommandsPrefix: string;
	getDynamicCommands(): IFuture<string[]>;
	generateDynamicCommands(): IFuture<void>;
	registerDynamicSubCommands(): void;
}