import * as log4js from "log4js";
import * as util from "util";
import * as stream from "stream";
import * as marked from "marked";
let TerminalRenderer = require("marked-terminal");
let chalk = require("chalk");
import { LoggerLevels } from "./constants";

export class Logger implements ILogger {
	private log4jsLogger: log4js.ILogger = null;
	private encodeRequestPaths: string[] = ['/appbuilder/api/itmstransporter/applications?username='];
	private encodeBody: boolean = false;
	private passwordRegex = /(password=).*?(['&,]|$)|(["']?.*?password["']?\s*:\s*["']).*?(["'])/i;
	private passwordReplacement = "$1$3*******$2$4";
	private passwordBodyReplacement = "$1*******$2";
	private static LABEL = "[WARNING]:";
	private requestBodyRegex = /(^\").*?(\"$)/;

	constructor($config: Config.IConfig,
		private $options: ICommonOptions) {
		let appenders: any = null;

		if (!$config.CI_LOGGER) {
			appenders = {
				out: {
					type: "console",
					layout: {
						type: 'pattern',
						pattern: '%[[%d]%] %[[%p]%]: %m',
						// pattern: '[%d] [%p]: %m',
					}
					// layout: { type: 'coloured' }
					// layout: { type: 'messagePassThrough' }
				}
			}
			// appenders.push(<any>{

			// });
		}

		const logLevel = this.$options.log || ($config.DEBUG ? LoggerLevels.Debug : LoggerLevels.Info);

		const categories: any = {
			default: { appenders: ['out'], level: logLevel },
			// task: { appenders: ['task'], level: 'info' }

		}

		log4js.configure(<any>{ appenders, categories });

		this.log4jsLogger = log4js.getLogger("default");

		// if (this.$options.log) {
		// 	this.log4jsLogger.setLevel(this.$options.log.toUpperCase());
		// } else {
		// 	this.log4jsLogger.setLevel($config.DEBUG ? LoggerLevels.Debug : LoggerLevels.Info);
		// }
	}

	setLevel(level: LoggerLevels): void {
		this.log4jsLogger.setLevel(level);
	}

	getLevel(): string {
		return this.log4jsLogger.level.toString();
	}

	fatal(...args: string[]): void {
		this.log4jsLogger.fatal.apply(this.log4jsLogger, args);
	}

	error(...args: string[]): void {
		let message = util.format.apply(null, args);
		let colorizedMessage = message.red;

		this.log4jsLogger.error.apply(this.log4jsLogger, [colorizedMessage]);
	}

	warn(...args: string[]): void {
		let message = util.format.apply(null, args);
		let colorizedMessage = message.yellow;

		this.log4jsLogger.warn.apply(this.log4jsLogger, [colorizedMessage]);
	}

	warnWithLabel(...args: string[]): void {
		let message = util.format.apply(null, args);
		this.warn(`${Logger.LABEL} ${message}`);
	}

	info(...args: string[]): void {
		this.log4jsLogger.info.apply(this.log4jsLogger, args);
	}

	debug(...args: string[]): void {
		let encodedArgs: string[] = this.getPasswordEncodedArguments(args);
		this.log4jsLogger.debug.apply(this.log4jsLogger, encodedArgs);
	}

	trace(...args: string[]): void {
		let encodedArgs: string[] = this.getPasswordEncodedArguments(args);
		this.log4jsLogger.trace.apply(this.log4jsLogger, encodedArgs);
	}

	out(...args: string[]): void {
		this.log4jsLogger.info.apply(this.log4jsLogger, args);
	}

	write(...args: string[]): void {
		process.stdout.write(util.format.apply(null, args));
	}

	prepare(item: any): string {
		if (typeof item === "undefined" || item === null) {
			return "[no content]";
		}
		if (typeof item === "string") {
			return item;
		}
		// do not try to read streams, because they may not be rewindable
		if (item instanceof stream.Readable) {
			return "[ReadableStream]";
		}

		// There's no point in printing buffers
		if (item instanceof Buffer) {
			return "[Buffer]";
		}

		return JSON.stringify(item);
	}

	public printInfoMessageOnSameLine(message: string): void {
		if (!this.$options.log || this.$options.log === "info") {
			this.write(message);
		}
	}

	public printMsgWithTimeout(message: string, timeout: number): Promise<void> {
		return new Promise<void>((resolve, reject) => {
			setTimeout(() => {
				this.printInfoMessageOnSameLine(message);
				resolve();
			}, timeout);

		});
	}

	public printMarkdown(...args: string[]): void {
		let opts = {
			unescape: true,
			link: chalk.red,
			tableOptions: {
				chars: { 'mid': '', 'left-mid': '', 'mid-mid': '', 'right-mid': '' },
				style: {
					'padding-left': 1,
					'padding-right': 1,
					head: ['green', 'bold'],
					border: ['grey'],
					compact: false
				}
			}
		};

		marked.setOptions({ renderer: new TerminalRenderer(opts) });
		let formattedMessage = marked(util.format.apply(null, args));
		this.write(formattedMessage);
	}

	private getPasswordEncodedArguments(args: string[]): string[] {
		return _.map(args, argument => {
			if (typeof argument !== 'string') {
				return argument;
			}

			argument = argument.replace(this.passwordRegex, this.passwordReplacement);

			if (this.encodeBody) {
				argument = argument.replace(this.requestBodyRegex, this.passwordBodyReplacement);
			}

			_.each(this.encodeRequestPaths, path => {
				if (argument.indexOf('path') > -1) {
					this.encodeBody = argument.indexOf(path) > -1;
					return false;
				}
			});

			return argument;
		});
	}
}

$injector.register("logger", Logger);
