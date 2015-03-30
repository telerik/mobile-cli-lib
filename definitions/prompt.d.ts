interface IPromptSchema {
	type: string;
	name: string;
	message: any;
	default?: any;
	choices?: any[];
	filter?: (userInput: any) => any;
	when?: (userAnswers: any) => boolean;
}

interface IPrompt {
	get(properties: IPromptSchema, action: (err: Error, result: any) => any): void;
	message: string;
	delimiter: string;
	colors: boolean;
	isDefaultValueEditable: boolean;
	prompt(properties: IPromptSchema[], callback: (err: Error, result: any) => any): IFuture<any>;
}

declare var cliPrompt: IPrompt;

declare module "inquirer" {
	export = cliPrompt;
}
