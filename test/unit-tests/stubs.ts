/* tslint:disable:no-empty */

import * as util from "util";

export class CommonLoggerStub implements ILogger {
	setLevel(level: string): void { }
	getLevel(): string { return undefined; }
	fatal(...args: string[]): void { }
	error(...args: string[]): void { }
	warn(...args: string[]): void {
		this.out.apply(this, args);
	}
	warnWithLabel(...args: string[]): void { }
	info(...args: string[]): void {
		this.out.apply(this, args);
	}
	debug(...args: string[]): void { }
	trace(...args: string[]): void {
		this.traceOutput += util.format.apply(null, args) + "\n";
	}

	public output = "";
	public traceOutput = "";

	out(...args: string[]): void {
		this.output += util.format.apply(null, args) + "\n";
	}

	write(...args: string[]): void { }

	prepare(item: any): string {
		return "";
	}

	printInfoMessageOnSameLine(message: string): void { }
	async printMsgWithTimeout(message: string, timeout: number): Promise<void> {
		return null;
	}

	printMarkdown(message: string): void { }
}

export class ErrorsStub implements IErrors {
	printCallStack: boolean = false;

	fail(formatStr: string, ...args: any[]): never;
	fail(opts: { formatStr?: string; errorCode?: number; suppressCommandHelp?: boolean }, ...args: any[]): never;

	fail(...args: any[]): never {
		throw new Error(util.format.apply(null, args));
	}

	failWithoutHelp(message: string, ...args: any[]): never {
		throw new Error(message);
	}

	async beginCommand(action: () => Promise<boolean>, printHelpCommand: () => Promise<boolean>): Promise<boolean> {
		return action();
	}

	executeAction(action: Function): any {
		return action();
	}

	verifyHeap(message: string): void { }
}

export class HooksServiceStub implements IHooksService {
	async executeBeforeHooks(commandName: string): Promise<void> {
		return;
	}
	async executeAfterHooks(commandName: string): Promise<void> {
		return;
	}

	hookArgsName = "hookArgs";
}
