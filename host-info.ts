///<reference path="../.d.ts"/>
"use strict";

import Future = require("fibers/future");

export function isWindows() {
	return process.platform === "win32";
}

export function isWindows64() {
	return isWindows() && (process.arch === "x64" || process.env.hasOwnProperty("PROCESSOR_ARCHITEW6432"));
}

export function isWindows32() {
	return isWindows() && !isWindows64();
}

export function isDarwin() {
	return process.platform === "darwin";
}

export function isLinux() {
	return process.platform === "linux";
}

export function isLinux64(): boolean {
	return isLinux() && process.config.variables.host_arch === "x64";
}

export function dotNetVersion(message: string) : IFuture<string> {
	if (isWindows()) {
		var result = new Future<string>();
		var Winreg = require("winreg");
		var regKey = new Winreg({
			hive: Winreg.HKLM,
			key:  '\\Software\\Microsoft\\NET Framework Setup\\NDP\\v4\\Client'
		});
		regKey.get("Version", (err: Error, value: any) => {
			if (err) {
				result.throw(new Error(message));
			} else {
				result.return(value.value);
			}
		});
		return result;
	}
}

export function isDotNet40Installed(message?: string) : IFuture<boolean> {
	return (() => {
		if (isWindows()) {
			try {
				dotNetVersion(message || "An error occurred while reading the registry.").wait();
				return true;
			} catch (e) {
				return false;
			}
		}
	}).future<boolean>()();
}
