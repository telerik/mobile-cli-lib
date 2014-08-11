interface ICommand extends ICommandOptions {
	execute(args: string[]): IFuture<void>;
}

interface ISimilarCommand {
	name: string;
	rating: number;
}

interface ICommandArgument { }