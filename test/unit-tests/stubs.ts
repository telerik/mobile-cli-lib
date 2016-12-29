/* tslint:disable:no-empty */

import * as util from "util";
import Future = require("fibers/future");

export class CommonLoggerStub implements ILogger {
	setLevel(level: string): void { }
	getLevel(): string { return undefined; }
	fatal(...args: string[]): void {}
	error(...args: string[]): void {}
	warn(...args: string[]): void {
		this.out.apply(this, args);
	}
	warnWithLabel(...args: string[]): void {}
	info(...args: string[]): void {
		this.out.apply(this, args);
	}
	debug(...args: string[]): void {}
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
	printMsgWithTimeout(message: string, timeout: number): IFuture<void> {
		return null;
	}

	printMarkdown(message: string): void { }
}

export class ErrorsStub implements IErrors {
	printCallStack: boolean = false;

	fail(formatStr:string, ...args: any[]): void;
	fail(opts:{formatStr?: string; errorCode?: number; suppressCommandHelp?: boolean}, ...args: any[]): void;

	fail(...args: any[]) {
		throw new Error(util.format.apply(null, args));
	}

	failWithoutHelp(message: string, ...args: any[]): void {
		throw new Error(message);
	}

	beginCommand(action:() => IFuture<boolean>, printHelpCommand: () => IFuture<boolean>): IFuture<boolean> {
		return action();
	}

	executeAction(action: Function): any {
		return action();
	}

	verifyHeap(message: string): void { }
}

export class HooksServiceStub implements IHooksService {
	executeBeforeHooks(commandName: string): IFuture<void> {
		return Promise.resolve();
	}
	executeAfterHooks(commandName: string): IFuture<void> {
		return Promise.resolve();
	}

	hookArgsName = "hookArgs";
}
