interface ICommand extends ICommandOptions {
	execute(args: string[]): IFuture<void>;
	allowedParameters: ICommandParameter[];

	// Implement this method in cases when you want to have your own logic for validation. In case you do not implement it,
	// the command will be evaluated from CommandsService's canExecuteCommand method.
	// One possible case where you can use this method is when you have two commandParameters, neither of them is mandatory,
	// but at least one of them is required. Used in prop|add, prop|set, etc. commands as their logic is complicated and 
	// default validation in CommandsService is not applicable.
	canExecute?(args: string[]): IFuture<boolean>;
}

interface ISimilarCommand {
	name: string;
	rating: number;
}

interface ICommandArgument { }

interface ICommandParameter {
	mandatory: boolean;
	validate(value: string, errorMessage?: string): IFuture<boolean>;
}

interface IStringParameterBuilder {
	createMandatoryParameter(errorMsg: string): ICommandParameter;
}
