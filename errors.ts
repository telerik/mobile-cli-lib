import * as util from "util";
import * as path from "path";
import * as fiberBootstrap from "./fiber-bootstrap";

// we need this to overwrite .stack property (read-only in Error)
function Exception() {
	/* intentionally left blank */
}
Exception.prototype = new Error();

function resolveCallStack(error: Error): string {
	let stackLines: string[]= error.stack.split("\n");
	let parsed = _.map(stackLines, (line: string): any => {
		let match = line.match(/^\s*at ([^(]*) \((.*?):([0-9]+):([0-9]+)\)$/);
		if (match) {
			return match;
		}

		match = line.match(/^\s*at (.*?):([0-9]+):([0-9]+)$/);
		if (match) {
			match.splice(1, 0, "<anonymous>");
			return match;
		}

		return line;
	});

	let SourceMapConsumer = require("./vendor/source-map").sourceMap.SourceMapConsumer;
	let fs = require("fs");

	let remapped = _.map(parsed, (parsedLine) => {
		if (_.isString(parsedLine)) {
			return parsedLine;
		}

		let functionName = parsedLine[1];
		let fileName = parsedLine[2];
		let line = +parsedLine[3];
		let column = +parsedLine[4];

		let mapFileName = fileName + ".map";
		if (!fs.existsSync(mapFileName)) {
			return parsedLine.input;
		}

		let mapData = JSON.parse(fs.readFileSync(mapFileName).toString());

		let consumer = new SourceMapConsumer(mapData);
		let sourcePos = consumer.originalPositionFor({line: line, column: column});

		let source = path.join(path.dirname(fileName), sourcePos.source);

		return util.format("    at %s (%s:%s:%s)", functionName, source, sourcePos.line, sourcePos.column);
	});

	let outputMessage = remapped.join("\n");
	if(outputMessage.indexOf(error.message) === -1) {
		// when fibers throw error in node 0.12.x, the stack does NOT contain the message
		outputMessage = outputMessage.replace(/Error/, "Error: " + error.message);
	}

	return outputMessage;
}

export function installUncaughtExceptionListener(actionOnException?: () => void): void {
	process.on("uncaughtException", (err: Error) => {
		let callstack = err.stack;
		if (callstack) {
			try {
				callstack = resolveCallStack(err);
			} catch(err) {
				console.error("Error while resolving callStack:", err);
			}
		}
		console.error(callstack || err.toString());
		tryTrackException(err, $injector);

		if(actionOnException) {
			actionOnException();
		}
	});
}

function tryTrackException(error: Error, injector: IInjector): void {
	let disableAnalytics: boolean;
	try {
		disableAnalytics = injector.resolve("staticConfig").disableAnalytics;
	} catch(err) {
		// We should get here only in our unit tests.
		disableAnalytics = true;
	}

	if(!disableAnalytics) {
		try {
			let analyticsService = injector.resolve("analyticsService");
			fiberBootstrap.run(() => {
				analyticsService.trackException(error, error.message).wait();
			});
		} catch (e) {
			// Do not replace with logger due to cyclic dependency
			console.error("Error while reporting exception: " + e);
		}
	}
}

export class Errors implements IErrors {
	constructor(private $injector: IInjector) {
	}

	public printCallStack: boolean = false;

	fail(optsOrFormatStr: any, ...args: any[]): void {
		let opts = optsOrFormatStr;
		if (_.isString(opts)) {
			opts = { formatStr: opts };
		}

		let exception: any = new (<any>Exception)();
		exception.name = opts.name || "Exception";
		exception.message = util.format(opts.formatStr, ...args);
		try {
			exception.message = this.$injector.resolve("messagesService").getMessage(opts.formatStr, ...args);
		} catch (err) {
			// Ignore
		}
		exception.stack = (new Error(exception.message)).stack;
		exception.errorCode = opts.errorCode || ErrorCodes.UNKNOWN;
		exception.suppressCommandHelp = opts.suppressCommandHelp;
		this.$injector.resolve("logger").trace(opts.formatStr);
		throw exception;
	}

	public failWithoutHelp(message: string, ...args: any[]): void {
		args.unshift(message);
		this.fail({ formatStr: util.format.apply(null, args), suppressCommandHelp: true });
	}

	public beginCommand(action: () => IFuture<boolean>, printCommandHelp: () => IFuture<boolean>): IFuture<boolean> {
		return (() => {
			try {
				return action().wait();
			} catch(ex) {
				let loggerLevel: string = $injector.resolve("logger").getLevel().toUpperCase();
				let printCallStack = this.printCallStack || loggerLevel === "TRACE" || loggerLevel === "DEBUG";
				console.error(printCallStack
					? resolveCallStack(ex)
					: "\x1B[31;1m" + ex.message + "\x1B[0m");

				if (!ex.suppressCommandHelp) {
					printCommandHelp().wait();
				}

				tryTrackException(ex, this.$injector);
				process.exit(_.isNumber(ex.errorCode) ? ex.errorCode : ErrorCodes.UNKNOWN);
			}
		}).future<boolean>()();
	}

	// If you want to activate this function, start Node with flags --nouse_idle_notification and --expose_gc
	verifyHeap(message: string): void {
		if(global.gc) {
			console.log("verifyHeap: '%s'", message);
			global.gc();
		}
	}
}
$injector.register("errors", Errors);
