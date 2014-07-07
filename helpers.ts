///<reference path="../.d.ts"/>

export function isDarwin() {
	return process.platform.toUpperCase() === "DARWIN";
}

export function stringReplaceAll(string: string, find: any, replace: string): string {
	return string.split(find).join(replace);
}

export function getParsedOptions(options, shorthands) {
	var yargs: any = require("yargs");

	Object.keys(options).forEach((opt) => {
		var type = options[opt];
		if (type === String) {
			yargs.string(opt);
		} else if (type === Boolean) {
			yargs.boolean(opt);
		}
	});

	Object.keys(shorthands).forEach((key) => {
		yargs.alias(key, shorthands[key]);
	});

	var parsed = yargs.argv;

	Object.keys(parsed).forEach((opt) => {
		if (options[opt] !== Boolean && typeof(parsed[opt]) === 'boolean') {
			delete parsed[opt];
		}
	});

	return parsed;
}