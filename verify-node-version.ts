
// This function must be separate to avoid dependencies on C++ modules - it must execute precisely when other functions cannot

// Use only ES5 code here - pure JavaScript can be executed with any Node.js version (even 0.10, 0.12).
/* tslint:disable:no-var-keyword no-var-requires prefer-const*/
var os = require("os"),
	semver = require("semver"),
	util = require("util");

// These versions cannot be used with CLI due to bugs in the node itself.
// We are absolutely sure we cannot work with them, so inform the user if he is trying to use any of them and exit the process.
var versionsCausingFailure = ["0.10.34", "4.0.0", "4.2.0", "5.0.0"];
var minimumRequiredVersion = "6.0.0";

export function verifyNodeVersion(supportedVersionsRange: string, cliName: string, deprecatedVersions?: string[]): void {
	// The colors module should not be assigned to variable because the lint task will fail for not used variable.
	require("colors");

	var nodeVer = process.version.substr(1),
		isNodeVersionDeprecated = false;

	if (versionsCausingFailure.indexOf(nodeVer) !== -1 || !semver.valid(nodeVer) || semver.lt(nodeVer, minimumRequiredVersion)) {
		console.error(util.format("%sNode.js '%s' is not supported. To be able to work with %s CLI, install any Node.js version in the following range: %s.%s",
			os.EOL, nodeVer, cliName, supportedVersionsRange, os.EOL).red.bold);
		process.exit(1);
	}

	if (deprecatedVersions) {
		deprecatedVersions.forEach(version => {
			if (semver.satisfies(nodeVer, version)) {
				var message = os.EOL + "Support for Node.js " + version + " is deprecated and will be removed in the next release of " + cliName + ". Please, upgrade to the latest Node.js LTS version. " + os.EOL ;
				console.warn(message.yellow.bold);
				isNodeVersionDeprecated = true;
				return false;
			}
		});
	}

	if (!isNodeVersionDeprecated) {
		var checkSatisfied = semver.satisfies(nodeVer, supportedVersionsRange);
		if (!checkSatisfied) {
			console.log(util.format("%sSupport for Node.js %s is not verified. This CLI might not install or run properly.%s", os.EOL, nodeVer, os.EOL).yellow.bold);
		}
	}
}
/* tslint:enable */
