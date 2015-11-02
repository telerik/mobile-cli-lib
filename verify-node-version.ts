
// This function must be separate to avoid dependencies on C++ modules - it must execute precisely when other functions cannot

"use strict";
import {EOL} from "os";

export function verifyNodeVersion(version: string): void {
	require("colors");
	let nodeVer = process.version.substr(1);
	let checkSatisfied = require("semver").satisfies(nodeVer, version);
	if (!checkSatisfied) {
		console.log(`${EOL}Support for node.js ${nodeVer} is not verified. This CLI might not install or run properly.${EOL}`.yellow.bold);
	}
}
