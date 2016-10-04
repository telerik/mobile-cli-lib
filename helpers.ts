import * as uuid from "node-uuid";
import * as Fiber from "fibers";
import * as net from "net";
let Table = require("cli-table");
import Future = require("fibers/future");
import { platform } from "os";

function bashQuote(s: string): string {
	if (s[0] === "'" && s[s.length - 1] === "'") {
		return s;
	}
	// replace ' with '"'"' and wrap in ''
	return "'" + s.replace(/'/g, '\'"\'"\'') + "'";
}

function cmdQuote(s: string): string {
	if (s[0] === '"' && s[s.length - 1] === '"') {
		return s;
	}
	// replace " with \" and wrap in ""
	return '"' + s.replace(/"/g, '\\"') + '"';
}

export function quoteString(s: string): string {
	if (!s) {
		return s;
	}

	return (platform() === "win32") ? cmdQuote(s) : bashQuote(s);
}

export function createGUID(useBraces: boolean = true) {
	let output: string;

	if (useBraces) {
		output = "{" + uuid.v4() + "}";
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
	return _.includes([301, 302, 303, 307, 308], response.statusCode);
}

export function formatListOfNames(names: string[], conjunction = "or"): string {
	if (names.length <= 1) {
		return names[0];
	} else {
		return _.initial(names).join(", ") + " " + conjunction + " " + names[names.length - 1];
	}
}

export function getRelativeToRootPath(rootPath: string, filePath: string): string {
	let relativeToRootPath = filePath.substr(rootPath.length);
	return relativeToRootPath;
}

function getVersionArray(version: string | IVersionData): number[] {
	let result: number[] = [],
		parseLambda = (x: string) => parseInt(x, 10),
		filterLambda = (x: number) => !isNaN(x);

	if (typeof version === "string") {
		let versionString = <string>version.split("-")[0];
		result = _.map(versionString.split("."), parseLambda);
	} else {
		result = _(version).map(parseLambda).filter(filterLambda).value();
	}

	return result;
}

export function versionCompare(version1: string | IVersionData, version2: string | IVersionData): number {
	let v1array = getVersionArray(version1),
		v2array = getVersionArray(version2);

	if (v1array.length !== v2array.length) {
		throw new Error("Version strings are not in the same format");
	}

	for (let i = 0; i < v1array.length; ++i) {
		if (v1array[i] !== v2array[i]) {
			return v1array[i] > v2array[i] ? 1 : -1;
		}
	}

	return 0;
}

export function isInteractive(): boolean {
	return process.stdout.isTTY && process.stdin.isTTY;
}

export function toBoolean(str: any) {
	return str && str.toString().toLowerCase() === "true";
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

	return input.replace(/\s/gi, "").length < 1;
}

export function getCurrentEpochTime(): number {
	let dateTime = new Date();
	return dateTime.getTime();
}

export function sleep(ms: number): void {
	let fiber = Fiber.current;
	setTimeout(() => fiber.run(), ms);
	Fiber.yield();
}

export function createTable(headers: string[], data: string[][]): any {
	let table = new Table({
		head: headers,
		chars: { "mid": "", "left-mid": "", "mid-mid": "", "right-mid": "" }
	});

	_.forEach(data, row => table.push(row));
	return table;
}

export function remove<T>(array: T[], predicate: (element: T) => boolean, numberOfElements?: number): T[] {
	numberOfElements = numberOfElements || 1;
	let index = _.findIndex(array, predicate);
	if (index === -1) {
		return new Array<T>();
	}

	return <T[]>array.splice(index, numberOfElements);
}

export function trimSymbol(str: string, symbol: string) {
	while (str.charAt(0) === symbol) {
		str = str.substr(1);
	}

	while (str.charAt(str.length - 1) === symbol) {
		str = str.substr(0, str.length - 1);
	}

	return str;
}

// TODO: Use generic for predicatе predicate: (element: T|T[]) when TypeScript support this.
export function getFuturesResults<T>(futures: IFuture<T | T[]>[], predicate: (element: any) => boolean): T[] {
	Future.wait(futures);
	return _(futures)
		.map(f => f.get())
		.filter(predicate)
		.flatten<T>()
		.value();
}

export function appendZeroesToVersion(version: string, requiredVersionLength: number): string {
	let zeroesToAppend = requiredVersionLength - version.split(".").length;
	for (let index = 0; index < zeroesToAppend; index++) {
		version += ".0";
	}

	return version;
}

export function decorateMethod(before: (method1: any, self1: any, args1: any[]) => void, after: (method2: any, self2: any, result2: any, args2: any[]) => any) {
	return (target: Object, propertyKey: string, descriptor: TypedPropertyDescriptor<Function>) => {
		let sink = descriptor.value;
		descriptor.value = function (...args: any[]): any {
			if (before) {
				before(sink, this, args);
			}
			let result = sink.apply(this, args);
			if (after) {
				return after(sink, this, result, args);
			}
			return result;
		};
	};
}

export function hook(commandName: string) {
	function getHooksService(self: any): IHooksService {
		let hooksService: IHooksService = self.$hooksService;
		if (!hooksService) {
			let injector = self.$injector;
			if (!injector) {
				throw Error('Type with hooks needs to have either $hooksService or $injector injected.');
			}
			hooksService = injector.resolve('hooksService');
		}
		return hooksService;
	}

	function prepareArguments(method: any, args: any[], hooksService: IHooksService): { [key: string]: any } {
		annotate(method);
		let argHash: any = {};
		for (let i = 0; i < method.$inject.args.length; ++i) {
			argHash[method.$inject.args[i]] = args[i];
		}
		argHash.$arguments = args;
		let result: any = {};
		result[hooksService.hookArgsName] = argHash;

		return result;
	}

	return decorateMethod(
		(method: any, self: any, args: any[]) => {
			let hooksService = getHooksService(self);
			hooksService.executeBeforeHooks(commandName, prepareArguments(method, args, hooksService)).wait();
		},
		(method: any, self: any, resultPromise: any, args: any[]) => {
			let result = resultPromise.wait();
			let hooksService = getHooksService(self);
			hooksService.executeAfterHooks(commandName, prepareArguments(method, args, hooksService)).wait();
			return Future.fromResult(result);
		});
}

export function isFuture(candidateFuture: any): boolean {
	return !!(candidateFuture && typeof (candidateFuture.wait) === "function");
}

export function whenAny<T>(...futures: IFuture<T>[]): IFuture<IFuture<T>> {
	let resultFuture = new Future<IFuture<T>>();
	let futuresLeft = futures.length;

	_.each(futures, future => {
		future.resolve((error, result?) => {
			futuresLeft--;

			if (!resultFuture.isResolved()) {
				if (typeof error === "undefined") {
					resultFuture.return(future);
				} else if (futuresLeft === 0) {
					resultFuture.throw(new Error("None of the futures succeeded."));
				}
			}
		});
	});

	return resultFuture;
}

export function connectEventually(factory: () => net.Socket, handler: (_socket: net.Socket) => void): void {
	function tryConnect() {
		let tryConnectAfterTimeout = setTimeout.bind(undefined, tryConnect, 1000);

		let socket = factory();
		socket.on("connect", () => {
			socket.removeListener("error", tryConnectAfterTimeout);
			handler(socket);
		});
		socket.on("error", tryConnectAfterTimeout);
	}

	tryConnect();
}

export function connectEventuallyUntilTimeout(factory: () => net.Socket, timeout: number): IFuture<net.Socket> {
	let future = new Future<net.Socket>();
	let lastKnownError: Error;

	setTimeout(function () {
		if (!future.isResolved()) {
			future.throw(lastKnownError);
		}
	}, timeout);

	function tryConnect() {
		let tryConnectAfterTimeout = (error: Error) => {
			if (future.isResolved()) {
				return;
			}

			lastKnownError = error;
			setTimeout(tryConnect, 1000);
		};

		let socket = factory();
		socket.on("connect", () => {
			socket.removeListener("error", tryConnectAfterTimeout);
			future.return(socket);
		});
		socket.on("error", tryConnectAfterTimeout);
	}

	tryConnect();

	return future;
}

//--- begin part copied from AngularJS

//The MIT License
//
//Copyright (c) 2010-2012 Google, Inc. http://angularjs.org
//
//Permission is hereby granted, free of charge, to any person obtaining a copy
//of this software and associated documentation files (the "Software"), to deal
//in the Software without restriction, including without limitation the rights
//to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
//copies of the Software, and to permit persons to whom the Software is
//furnished to do so, subject to the following conditions:
//
//	The above copyright notice and this permission notice shall be included in
//all copies or substantial portions of the Software.
//
//	THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
//IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
//	FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
//AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
//LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
//	OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
//THE SOFTWARE.

let FN_NAME_AND_ARGS = /^function\s*([^\(]*)\(\s*([^\)]*)\)/m;
let FN_ARG_SPLIT = /,/;
let FN_ARG = /^\s*(_?)(\S+?)\1\s*$/;
let STRIP_COMMENTS = /((\/\/.*$)|(\/\*[\s\S]*?\*\/))/mg;

export function annotate(fn: any) {
	let $inject: any,
		fnText: string,
		argDecl: string[];

	if (typeof fn === "function") {
		if (!($inject = fn.$inject) || $inject.name !== fn.name) {
			$inject = { args: [], name: "" };
			fnText = fn.toString().replace(STRIP_COMMENTS, '');
			argDecl = fnText.match(FN_NAME_AND_ARGS);
			$inject.name = argDecl[1];
			if (fn.length) {
				argDecl[2].split(FN_ARG_SPLIT).forEach((arg) => {
					arg.replace(FN_ARG, (all, underscore, name) => $inject.args.push(name));
				});
			}
			fn.$inject = $inject;
		}
	}
	return $inject;
}

//--- end part copied from AngularJS

