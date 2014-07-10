///<reference path="../.d.ts"/>
import fs = require("fs");
import path = require("path");

export function isDarwin() {
	return process.platform.toUpperCase() === "DARWIN";
}

export function stringReplaceAll(string: string, find: any, replace: string): string {
	return string.split(find).join(replace);
}

export function isRequestSuccessful(request) {
	return request.statusCode >= 200 && request.statusCode < 300;
}

export function isResponseRedirect(response) {
	return _.contains([301, 302, 303, 307, 308], response.statusCode);
}

function enumerateFilesInDirectorySyncRecursive(foundFiles, directoryPath, filterCallback) {
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
export function enumerateFilesInDirectorySync(directoryPath, filterCallback?: (file: string, stat: fs.Stats) => boolean) {
	var result = [];
	enumerateFilesInDirectorySyncRecursive(result, directoryPath, filterCallback);
	return result;
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