///<reference path="../.d.ts"/>
"use strict";

import path = require("path");
var yargs: any = require("yargs");

var knownOpts: any = {
		"log": String,
		"verbose": Boolean,
		"path": String,
		"version": Boolean,
		"help": Boolean,
		"json": Boolean,
		"watch": Boolean,
		"avd": String,
		"profile-dir": String,
		// If you pass value with dash, yargs adds it to yargs.argv in two ways:
		// with dash and without dash, replacing first symbol after it with its toUpper equivalent
		"profileDir": String,
		"timeout": String,
		"device": String,
		"availableDevices": Boolean
	},
	shorthands = {
		"v": "verbose",
		"p": "path"
	},
	parsed = yargs.argv;

exports.setProfileDir = (defaultProfileDir: string) => {
	var selectedProfileDir: string = parsed["profile-dir"] || parsed["profileDir"] || defaultProfileDir;

	// Add the value to yargs arguments.
	parsed["profile-dir"] = selectedProfileDir;
	parsed["profileDir"] = selectedProfileDir;

	// Add the value to exported options.
	exports["profile-dir"] = selectedProfileDir;
	exports["profileDir"] = selectedProfileDir;
}

exports.knownOpts = knownOpts;
exports.shorthands = shorthands;

Object.keys(parsed).forEach((opt) => {
	if (typeof (parsed[opt]) === "number") {
		exports[opt] = parsed[opt].toString();
	} else {
		exports[opt] = parsed[opt];
	}
});

declare var exports: any;
export = exports;

