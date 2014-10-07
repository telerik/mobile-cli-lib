///<reference path="../.d.ts"/>
"use strict";
import fs = require("fs");
import path = require("path");
import util = require("util");
import _ = require("underscore"); 
var uuid = require("node-uuid");

export function createGUID(useBraces: boolean = true) {
	var output: string;

	if (useBraces) {
		output = '{' + uuid.v4() + '}';
	} else {
		output = uuid.v4();
	}

	return output;
}

export function stringReplaceAll(string: string, find: any, replace: string): string {
	return string.split(find).join(replace);
}

export function isRequestSuccessful(request: Server.IRequestResponseData) {
	return request.statusCode >= 200 && request.statusCode < 300;
}

export function isResponseRedirect(response: Server.IRequestResponseData) {
	return _.contains([301, 302, 303, 307, 308], response.statusCode);
}

function enumerateFilesInDirectorySyncRecursive(foundFiles: string[], directoryPath: string, filterCallback: (file: string, stat: IFsStats) => boolean): void {
	var $fs: IFileSystem = $injector.resolve("fs");
	var contents = $fs.readDirectory(directoryPath).wait();
	for (var i = 0; i < contents.length; ++i) {
		var file = path.join(directoryPath, contents[i]);
		var stat = $fs.getFsStats(file).wait();
		if (filterCallback && !filterCallback(file, stat)) {
			continue;
		}

		if (stat.isDirectory()) {
			enumerateFilesInDirectorySyncRecursive(foundFiles, file, filterCallback);
		} else {
			foundFiles.push(file);
		}
	}
}

// filterCallback: function(path: String, stat: fs.Stats): Boolean
export function enumerateFilesInDirectorySync(directoryPath: string, filterCallback?: (file: string, stat: IFsStats) => boolean): string[] {
	var result: string[] = [];
	enumerateFilesInDirectorySyncRecursive(result, directoryPath, filterCallback);
	return result;
}

export function getParsedOptions(options: any, shorthands: any) {
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

	var argv = yargs.argv;
	var parsed = {};
	_.each(_.keys(argv), (opt) => {
		if (typeof argv[opt] === "number") {
			parsed[opt] = argv[opt].toString();
		} else {
			parsed[opt] = argv[opt];
		}
	});

	validateYargsArguments(parsed, options, shorthands);
	return parsed;
}

export function validateYargsArguments(parsed: any, knownOpts: any, shorthands: any, isInTestMode?: boolean): void {
	if (path.basename(process.argv[1]) === "appbuilder.js" || isInTestMode) {
		_.each(_.keys(parsed), (opt) => {
			var option = shorthands[opt] ? shorthands[opt] : opt;

			if (option !== "_" && option !== "$0" && !knownOpts[option]) {
				breakExecution(util.format("The option '%s' is not supported. To see command's options, use '$ appbuilder %s --help'. To see all commands use '$ appbuilder help'.", opt, process.argv[2]));
			} else if (knownOpts[option] !== Boolean && typeof (parsed[opt]) === 'boolean') {
				breakExecution(util.format("The option '%s' requires a value.", opt));
			} else if (knownOpts[option] === String && isNullOrWhitespace(parsed[opt])) {
				breakExecution(util.format("The option '%s' requires non-empty value.", opt));
			} else if (knownOpts[option] === Boolean && typeof (parsed[opt]) !== 'boolean') {
				breakExecution(util.format("The option '%s' does not accept values.", opt));
			}
		});
	}
}

export function breakExecution(message: string): void {
	console.log("\x1B[31;1m" + message + "\x1B[0m");
	process.exit(ErrorCodes.INVALID_ARGUMENT);
}

export function formatListOfNames(names: string[], conjunction = "or"): string {
	if (names.length <= 1) {
		return names[0];
	} else {
		return _.initial(names).join(", ") + " " + conjunction + " " + names[names.length - 1];
	}
}

export function getRelativeToRootPath(rootPath: string, filePath: string): string {
	var relativeToRootPath = filePath.substr(rootPath.length);
	return relativeToRootPath;
}

export function versionCompare(version1: string, version2: string): number {
	version1 = version1.split("-")[0];
	version2 = version2.split("-")[0];
	var v1array = _.map(version1.split("."), (x) => parseInt(x, 10)),
		v2array = _.map(version2.split("."), (x) => parseInt(x, 10));

	if (v1array.length !== v2array.length) {
		throw new Error("Version strings are not in the same format");
	}

	for (var i = 0; i < v1array.length; ++i) {
		if (v1array[i] !== v2array[i]) {
			return v1array[i] > v2array[i] ? 1 : -1;
		}
	}

	return 0;
}

export function isInteractive(): boolean {
	return process.stdout.isTTY && process.stdin.isTTY;
}

export function toBoolean(str: string) {
	return str === "true";
}

export function registerCommand(module: string, commandName: any, executor: (module: any, args: string[]) => IFuture<void>, opts?: ICommandOptions) {
	var factory = ():ICommand => {
		return {
			execute: (args:string[]):IFuture<void> => {
				var mod = $injector.resolve(module);
				return executor(mod, args);
			},
			disableAnalytics: opts && opts.disableAnalytics
		};
	};

	$injector.registerCommand(commandName, factory);
}

export function block(operation: () => void): void {
	if (isInteractive()) {
		process.stdin.setRawMode(false);
	}
	operation();
	if (isInteractive()) {
		process.stdin.setRawMode(true);
	}
}

export function isNumber(n: any): boolean {
	return !isNaN(parseFloat(n)) && isFinite(n);
}

export function fromWindowsRelativePathToUnix(windowsRelativePath: string): string {
	return windowsRelativePath.replace(/\\/g, "/");
}

export function isNullOrWhitespace(input: string): boolean {
	if (!input) {
		return true;
	}

	return input.replace(/\s/gi, '').length < 1;
}
