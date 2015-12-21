///<reference path="../.d.ts"/>
"use strict";

import * as stream from "stream";
import Future = require("fibers/future");

export class ProtonLogger implements ILogger {
	setLevel(level: string): void {
		/* left for future implementation */
	}

	getLevel(): string {
		/* improve future implementation */
		return "INFO";
	}

	fatal(...args: string[]): void {
		/* left for future implementation */
	}

	error(...args: string[]): void {
		/* left for future implementation */
	}

	warn(...args: string[]): void {
		/* left for future implementation */
	}

	warnWithLabel(...args: string[]): void {
		/* left for future implementation */
	}

	info(...args: string[]): void {
		/* left for future implementation */
	}

	debug(...args: string[]): void {
		/* left for future implementation */
	}

	trace(...args: string[]): void {
		/* left for future implementation */
	}

	out(...args: string[]): void {
		/* left for future implementation */
	}

	write(...args: string[]): void {
		/* left for future implementation */
	}

	prepare(item: any): string {
		if (typeof item === "undefined" || item === null) {
			return "[no content]";
		}
		if (typeof item  === "string") {
			return item;
		}
		// do not try to read streams, because they may not be rewindable
		if (item instanceof stream.Readable) {
			return "[ReadableStream]";
		}

		return JSON.stringify(item);
	}

	public printInfoMessageOnSameLine(message: string): void {
		/* left for future implementation */
	}

	public printMsgWithTimeout(message: string, timeout: number): IFuture <void> {
		let printMsgFuture = new Future<void>();
		setTimeout(() => {
			this.printInfoMessageOnSameLine(message);
			printMsgFuture.return();
		}, timeout);

		return printMsgFuture;
	}

	public printMarkdown(...args: string[]): void {
		/* left for future implementation */
	}
}
$injector.register("logger", ProtonLogger);
