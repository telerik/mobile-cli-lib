interface ILogger {
	setLevel(level: string): void;
	fatal(formatStr: any, ...args: string[]): void;
	error(formatStr: any, ...args: string[]): void;
	warn(formatStr: any, ...args: string[]): void;
	info(formatStr: any, ...args: string[]): void;
	debug(formatStr: any, ...args: string[]): void;
	trace(formatStr: any, ...args: string[]): void;

	out(formatStr: any, ...args: string[]): void;
	write(...args: string[]): void;

	prepare(item: any): string;
	printInfoMessageOnSameLine(message: string): void;
	printMsgWithTimeout(message: string, timeout: number): IFuture <void>;
}