interface IInjector extends IDisposable {
	require(name: string, file: string): void;
	require(names: string[], file: string): void;
	requirePublic(names: string | string[], file: string): void;
	requireCommand(name: string, file: string): void;
	requireCommand(names: string[], file: string): void;
	/**
	 * Resolves an implementation by constructor function.
	 * The injector will create new instances for every call.
	 */
	resolve(ctor: Function, ctorArguments?: { [key: string]: any }): any;
	/**
	 * Resolves an implementation by name.
	 * The injector will create only one instance per name and return the same instance on subsequent calls.
	 */
	resolve(name: string, ctorArguments?: IDictionary<any>): any;
	resolveCommand(name: string): ICommand;
	register(name: string, resolver: any, shared?: boolean): void;
	registerCommand(name: string, resolver: any): void;
	registerCommand(names: string[], resolver: any): void;
	getRegisteredCommandsNames(includeDev: boolean): string[];
	dynamicCallRegex: RegExp;
	dynamicCall(call: string, args?: any[]): IFuture<any>;
	isDefaultCommand(commandName: string): boolean;
	isValidHierarchicalCommand(commandName: string, commandArguments: string[]): boolean;
	getChildrenCommandsNames(commandName: string): string[];
	buildHierarchicalCommand(parentCommandName: string, commandLineArguments: string[]): any;
	publicApi: any;
	_publicApi: any;
}

declare var $injector: IInjector;