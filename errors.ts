///<reference path="../.d.ts"/>
"use strict";

import util = require("util");
import path = require("path");
import helpers = require("./helpers");

// we need this to overwrite .stack property (read-only in Error)
function Exception() {}
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

export function installUncaughtExceptionListener(): void {
	process.on("uncaughtException", (err: Error) => {
		let callstack = err.stack;
		if (callstack) {
			callstack = resolveCallStack(err);
		}
		console.log(callstack || err.toString());

		if(!$injector.resolve("staticConfig").disableAnalytics) {
			try {
				let analyticsService = $injector.resolve("analyticsService");
				analyticsService.trackException(err, callstack);
			} catch (e) {
				// Do not replace with logger due to cyclic dependency
				console.log("Error while reporting exception: " + e);
			}
		}

		process.exit(ErrorCodes.UNKNOWN);
	});
}

export class Errors implements IErrors {

	public printCallStack: boolean = false;

	fail(optsOrFormatStr: any, ...args: any[]): void {
		let opts = optsOrFormatStr;
		if (_.isString(opts)) {
			opts = { formatStr: opts };
		}

		args.unshift(opts.formatStr);

		let exception: any = new (<any>Exception)();
		exception.name = opts.name || "Exception";
		exception.message = util.format.apply(null, args);
		exception.stack = new Error(exception.message).stack;
		exception.errorCode = opts.errorCode || ErrorCodes.UNKNOWN;
		exception.suppressCommandHelp = opts.suppressCommandHelp;

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
				console.log(this.printCallStack
					? resolveCallStack(ex)
					: "\x1B[31;1m" + ex.message + "\x1B[0m");

				if (!ex.suppressCommandHelp) {
					printCommandHelp().wait();
				}

				process.exit(_.isNumber(ex.errorCode) ? ex.errorCode : ErrorCodes.UNKNOWN);
			}
		}).future<boolean>()();
	}


	public executeAction(action: Function): any {
		try {
			return action();
		} catch (ex) {
			console.log(this.printCallStack
				? resolveCallStack(ex)
				: "\x1B[31;1m" + ex.message + "\x1B[0m");

			process.exit(_.isNumber(ex.errorCode) ? ex.errorCode : ErrorCodes.UNKNOWN);
		}
	}

	// If you want to activate this function, start Node with flags --nouse_idle_notification and --expose_gc
	verifyHeap(message: string): void {
		if(global.gc) {
			console.log("verifyHeap: '%s'", message);
			global.gc();
		}
	}

	private getParsedOptions(options: any, shorthands: any, clientName: string): any {
		let action = () => {
			let yargs:any = require("yargs");
			_.each(options, (type, opt) => {
				if (type === String) {
					yargs.string(opt);
				} else if (type === Boolean) {
					yargs.boolean(opt);
				}
			});

			Object.keys(shorthands).forEach(key => yargs.alias(key, shorthands[key]));

			let argv = yargs.argv;
			let parsed:any = {};
			_.each(_.keys(argv), opt => parsed[opt] = (typeof argv[opt] === "number") ? argv[opt].toString() : argv[opt]);

			this.validateYargsArguments(parsed, options, shorthands, clientName);
			return parsed;
		};

		return this.executeAction(action);
	}

	public getYargsOriginalOption(option: string): string {
		let matchUpperCaseLetters = option.match(/(.+?)([A-Z])(.*)/);
		if(matchUpperCaseLetters) {
			// get here if option with upperCase letter is specified, for example profileDir
			// check if in knownOptions we have its kebabCase presentation
			let secondaryPresentation = util.format("%s-%s%s", matchUpperCaseLetters[1], matchUpperCaseLetters[2].toLowerCase(), matchUpperCaseLetters[3] || '');
			return this.getYargsOriginalOption(secondaryPresentation);
		}

		return option;
	}

	public validateYargsArguments(parsed: any, knownOpts: any, shorthands: any, clientName?: string): void {
		let knownOptionsKeys = _.keys(knownOpts);
		_.each(_.keys(parsed), (opt) => {
			let option: string = shorthands[opt] || opt;
			let secondaryPresentation = this.getYargsOriginalOption(option);
			option = _.contains(knownOptionsKeys, secondaryPresentation) ? secondaryPresentation : option;

			if (option !== "_" && option !== "$0" && !knownOpts[option]) {
				this.failWithoutHelp("The option '%s' is not supported. To see command's options, use '$ %s help %s'. To see all commands use '$ %s help'.", opt, clientName, process.argv[2], clientName);
			} else if (knownOpts[option] !== Boolean && typeof (parsed[opt]) === 'boolean') {
				this.failWithoutHelp("The option '%s' requires a value.", opt);
			} else if (opt !== "_" && _.isArray(parsed[opt]) && knownOpts[option] !== Array) {
				this.failWithoutHelp("You have set the %s option multiple times. Check the correct command syntax below and try again.", opt);
			} else if (knownOpts[option] === String && helpers.isNullOrWhitespace(parsed[opt])) {
				this.failWithoutHelp("The option '%s' requires non-empty value.", opt);
			} else if (knownOpts[option] === Boolean && typeof (parsed[opt]) !== 'boolean') {
				this.failWithoutHelp("The option '%s' does not accept values.", opt);
			}
		});
	}

	public validateArgs(client: string, knownOpts: any, shorthands: any): any {
		return this.getParsedOptions(knownOpts, shorthands, client);
	}
}
$injector.register("errors", Errors);
