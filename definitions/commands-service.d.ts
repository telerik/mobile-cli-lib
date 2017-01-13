interface ICommandsService {
	allCommands(opts: {includeDevCommands: boolean}): string[];
	tryExecuteCommand(commandName: string, commandArguments: string[]): Promise<void>;
	executeCommandUnchecked(commandName: string, commandArguments: string[]): Promise<boolean>;
	completeCommand(): Promise<boolean>;
}

interface ICommandsServiceProvider {
	dynamicCommandsPrefix: string;
	getDynamicCommands(): Promise<string[]>;
	generateDynamicCommands(): Promise<void>;
	registerDynamicSubCommands(): void;
}