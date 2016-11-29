// This function must be separate to avoid dependencies on C++ modules - it must execute precisely when other functions cannot

import {EOL} from "os";
import * as semver from "semver";

// These versions cannot be used with CLI due to bugs in the node itself.
// We are absolutely sure we cannot work with them, so inform the user if he is trying to use any of them and exit the process.
const versionsCausingFailure = ["0.10.34", "4.0.0", "4.2.0", "5.0.0"];
const minimumRequiredVersion = "4.2.1";

export function verifyNodeVersion(supportedVersionsRange: string, cliName: string, deprecationVersion: string): void {
	// The colors module should not be assigned to variable because the lint task will fail for not used variable.
	require("colors");
	const nodeVer = process.version.substr(1);

	if (versionsCausingFailure.indexOf(nodeVer) !== -1 || !semver.valid(nodeVer) || semver.lt(nodeVer, minimumRequiredVersion)) {
		console.error(`${EOL}Node.js '${nodeVer}' is not supported. To be able to work with ${cliName} CLI, install any Node.js version in the following range: ${supportedVersionsRange}.${EOL}`.red.bold);
		process.exit(1);
	}

	const checkSatisfied = semver.satisfies(nodeVer, supportedVersionsRange);
	if (!checkSatisfied) {
		console.log(`${EOL}Support for Node.js ${nodeVer} is not verified. This CLI might not install or run properly.${EOL}`.yellow.bold);
	}
}
