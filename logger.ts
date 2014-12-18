///<reference path="../.d.ts"/>
"use strict";

import log4js = require("log4js");
import util = require("util");
import stream = require("stream");
import options = require("./options");

export class Logger implements ILogger {
	private log4jsLogger: log4js.ILogger = null;
	
	constructor($config: Config.IConfig) {
		var appenders: log4js.IAppender[] = [];

		if (!$config.CI_LOGGER) {
			appenders.push({
				type: "console",
				layout: {
					type: "messagePassThrough"
				}
			});
		}

		log4js.configure({appenders: appenders});

		this.log4jsLogger = log4js.getLogger();

		if (options.log) {
			this.log4jsLogger.setLevel(options.log);
		} else {
			this.log4jsLogger.setLevel($config.DEBUG ? "TRACE" : "INFO");
		}
	}

	setLevel(level: string): void {
		this.log4jsLogger.setLevel(level);
	}

	fatal(...args: string[]): void {
		this.log4jsLogger.fatal.apply(this.log4jsLogger, args);
	}

	error(...args: string[]): void {
		this.log4jsLogger.error.apply(this.log4jsLogger, args);
	}

	warn(...args: string[]): void {
		var message = util.format.apply(null, args);
		var colorizedMessage = message.yellow;

		this.log4jsLogger.warn.apply(this.log4jsLogger, [colorizedMessage]);
	}

	info(...args: string[]): void {
		this.log4jsLogger.info.apply(this.log4jsLogger, args);
	}

	debug(...args: string[]): void {
		this.log4jsLogger.debug.apply(this.log4jsLogger, args);
	}

	trace(...args: string[]): void {
		this.log4jsLogger.trace.apply(this.log4jsLogger, args);
	}

	out(...args: string[]): void {
		console.log(util.format.apply(null, args));
	}

	write(...args: string[]): void {
		process.stdout.write(util.format.apply(null, args));
	}

	prepare(item: any): string {
		if (typeof item === "undefined" || item === null) {
			return "[nothing]";
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
}
$injector.register("logger", Logger);
