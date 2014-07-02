///<reference path="../.d.ts"/>

export function isDarwin() {
	return process.platform.toUpperCase() === "DARWIN";
}