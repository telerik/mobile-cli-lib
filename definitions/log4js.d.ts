declare module "log4js" {
	interface ILogger {
		fatal(formatStr: string, ...args: string[]): void;
		error(formatStr: string, ...args: string[]): void;
		warn(formatStr: string, ...args: string[]): void;
		info(formatStr: string, ...args: string[]): void;
		debug(formatStr: string, ...args: string[]): void;
		trace(formatStr: string, ...args: string[]): void;

		setLevel(level: string): void;
		level: any;
	}

	interface IConfiguration {
		appenders: IAppender[];
	}

	interface IAppender {
		type: string;
		layout: ILayout;
	}

	interface ILayout {
		type: string;
	}

	function configure(conf: IConfiguration): void;
	function getLogger(categoryName?: string): ILogger;
}
