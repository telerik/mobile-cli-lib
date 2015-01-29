///<reference path="../.d.ts"/>
"use strict";

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
