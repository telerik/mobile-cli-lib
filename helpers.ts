///<reference path="../.d.ts"/>
"use strict";
import fs = require("fs");
import path = require("path");
import util = require("util");
var uuid = require("node-uuid");
var options = require("./options");
import Future = require("fibers/future");
import Fiber = require("fibers");
var Table = require("cli-table");

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

export function getParsedOptions(options: any, shorthands: any, clientName: string) {
	var yargs: any = require("yargs");
	_.each(options, (type, opt) => {
		if (type === String) {
			yargs.string(opt);
		} else if (type === Boolean) {
			yargs.boolean(opt);
		}
	});

	Object.keys(shorthands).forEach(key => yargs.alias(key, shorthands[key]));

	var argv = yargs.argv;
	var parsed:any = {};
	_.each(_.keys(argv), opt => parsed[opt] =  (typeof argv[opt] === "number") ? argv[opt].toString() : argv[opt]);

	validateYargsArguments(parsed, options, shorthands, clientName);
	return parsed;
}

export function validateYargsArguments(parsed: any, knownOpts: any, shorthands: any, clientName?: string): void {
	if(path.basename(process.argv[1]).indexOf(clientName) !== -1) {
		var errors = $injector.resolve("$errors");
		_.each(_.keys(parsed), (opt) => {
			var option = shorthands[opt] ? shorthands[opt] : opt;

			if (option !== "_" && option !== "$0" && !knownOpts[option]) {
				errors.failWithoutHelp("The option '%s' is not supported. To see command's options, use '$ %s help %s'. To see all commands use '$ %s help'.", opt, clientName, process.argv[2], clientName);
			} else if (knownOpts[option] !== Boolean && typeof (parsed[opt]) === 'boolean') {
				errors.failWithoutHelp("The option '%s' requires a value.", opt);
			} else if (opt !== "_" && _.isArray(parsed[opt])) {
				errors.failWithoutHelp("You have set the %s option multiple times. Check the correct command syntax below and try again.", opt);
			} else if (knownOpts[option] === String && isNullOrWhitespace(parsed[opt])) {
				errors.failWithoutHelp("The option '%s' requires non-empty value.", opt);
			} else if (knownOpts[option] === Boolean && typeof (parsed[opt]) !== 'boolean') {
				errors.failWithoutHelp("The option '%s' does not accept values.", opt);
			}
		});
	}
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

export function printInfoMessageOnSameLine(message: string): void {
	if(!options.log || options.log === "info") {
		var logger: ILogger = $injector.resolve("logger");
		logger.write(message);
	}
}

export function getCurrentEpochTime(): number {
	var dateTime = new Date();
	return dateTime.getTime();
}

export function printMsgWithTimeout(message: string, timeout: number): IFuture <void> {
	var printMsgFuture = new Future<void>();
	setTimeout(() => {
		printInfoMessageOnSameLine(message);
		printMsgFuture.return();
	}, timeout);

	return printMsgFuture;
}

export function sleep(ms: number): void {
  var fiber = Fiber.current;
  setTimeout(() => fiber.run(), ms);
  Fiber.yield();
}

export function getPathToAdb(injector: IInjector): IFuture<string> {
	return ((): string => {
		try {
			var childProcess: IChildProcess = injector.resolve("childProcess");
			var logger: ILogger = injector.resolve("logger");
			var staticConfig: IStaticConfig = injector.resolve("staticConfig");

			var warningMessage = util.format("Unable to find adb in PATH. Default one from %s resources will be used.", staticConfig.CLIENT_NAME);
			var proc = childProcess.spawnFromEvent("adb", ["version"], "exit", undefined, { throwError: false }).wait();

			if(proc.stderr) {
				logger.warn(warningMessage);
				return staticConfig.adbFilePath;
			}
		} catch(e) {
			if(e.code === "ENOENT") {
				logger.warn(warningMessage);
				return staticConfig.adbFilePath;
			}
		}

		return "adb";
	}).future<string>()();
}

export function createTable(headers: string[], data: string[][]): any {
	var table = new Table({
		head: headers,
		chars: { 'mid': '', 'left-mid': '', 'mid-mid': '', 'right-mid': '' }
	});

	_.forEach(data, row => table.push(row));
	return table;
}
