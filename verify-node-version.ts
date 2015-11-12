
// This function must be separate to avoid dependencies on C++ modules - it must execute precisely when other functions cannot

"use strict";
import {EOL} from "os";

// These versions cannot be used with CLI due to bugs in the node itself.
// We are absolutely sure we cannot work with them, so inform the user if he is trying to use any of them and exit the process.
let versionsCausingFailure = ["0.10.34", "4.0.0", "4.2.0", "5.0.0"];

export function verifyNodeVersion(supportedVersionsRange: string): void {
	require("colors");
	let nodeVer = process.version.substr(1);

	if (versionsCausingFailure.indexOf(nodeVer) !== -1) {
		console.error(`${EOL}Node.js '${nodeVer}' is not supported. To be able to work with this CLI, install any Node.js version in the following range: ${supportedVersionsRange}.${EOL}`.red.bold);
		process.exit(1);
	}

	let checkSatisfied = require("semver").satisfies(nodeVer, supportedVersionsRange);
	if (!checkSatisfied) {
		console.log(`${EOL}Support for node.js ${nodeVer} is not verified. This CLI might not install or run properly.${EOL}`.yellow.bold);
	}
}
