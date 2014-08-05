///<reference path="../.d.ts"/>

import log4js = require("log4js");
import util = require("util");
import options = require("./options");

export class Logger implements ILogger {
	private log4jsLogger = null;
	
	constructor($config: Config.IConfig) {
		var appenders = [];

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

	fatal(...args): void {
		this.log4jsLogger.fatal.apply(this.log4jsLogger, args);
	}

	error(...args): void {
		this.log4jsLogger.error.apply(this.log4jsLogger, args);
	}

	warn(...args): void {
		this.log4jsLogger.warn.apply(this.log4jsLogger, args);
	}

	info(...args): void {
		this.log4jsLogger.info.apply(this.log4jsLogger, args);
	}

	debug(...args): void {
		this.log4jsLogger.debug.apply(this.log4jsLogger, args);
	}

	trace(...args): void {
		this.log4jsLogger.trace.apply(this.log4jsLogger, args);
	}

	out(...args): void {
		console.log(util.format.apply(null, args));
	}

	write(...args): void {
		process.stdout.write(util.format.apply(null, args));
	}
}
$injector.register("logger", Logger);

