///<reference path="../.d.ts"/>
/* tslint:disable:no-empty */
"use strict";

import * as util from "util";

export class CommonLoggerStub implements ILogger {
	setLevel(level: string): void { }
	getLevel(): string { return undefined; }
	fatal(...args: string[]): void {}
	error(...args: string[]): void {}
	warn(...args: string[]): void {}
	warnWithLabel(...args: string[]): void {}
	info(...args: string[]): void {}
	debug(...args: string[]): void {}
	trace(...args: string[]): void {}

	public output = "";

	out(...args: string[]): void {
		this.output += util.format(...args) + "\n";
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
