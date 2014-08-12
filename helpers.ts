///<reference path="../.d.ts"/>
"use strict";
import fs = require("fs");
import path = require("path");

export function isDarwin() {
	return process.platform === "darwin";
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

export function getParsedOptions(options: any, shorthands: any, defaultProfileDir?: string) {
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

	parsed["profile-dir"] = parsed["profile-dir"] || defaultProfileDir;

	return parsed;
}

export function formatListOfNames(names: string[], conjunction = "or"): string {
	if (names.length <= 1) {
		return names[0];
	} else {
		return _.initial(names).join(", ") + " " + conjunction + " " + names[names.length - 1];
	}
}

export function isWindows() {
	return process.platform === "win32";
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