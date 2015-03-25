///<reference path="../.d.ts"/>
"use strict";
import _ = require("lodash");
import path = require("path");
import helpers = require("./helpers");
var yargs: any = require("yargs");

// If you pass value with dash, yargs adds it to yargs.argv in two ways:
// with dash and without dash, replacing first symbol after it with its toUpper equivalent
// ex, "$ <cli name> emulate android --profile-dir" will add profile-dir to yargs.argv as profile-dir and profileDir
// IMPORTANT: In your code, it is better to use the value without dashes (profileDir in the example).
// This way your code will work in case "$ <cli name> emulate android --profile-dir" or "$ <cli name> emulate android --profileDir" is used by user.
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
	"timeout": String,
	"device": String,
	"availableDevices": Boolean,
	"appid": String,
	"geny": String,
	"debug-brk": Boolean,
	"debug-port": Number,
	"get-port": Boolean,
	"start": Boolean,
	"stop": Boolean,
	"ddi": String, // the path to developer  disk image
	"print-app-output": Boolean
};
var shorthands: IStringDictionary = {
	"v": "verbose",
	"p": "path",
	"h": "help"
};
var parsed: any = yargs.argv;

exports.setProfileDir = (defaultProfileDir: string) => {
	var selectedProfileDir: string = parsed["profile-dir"] || parsed["profileDir"] || defaultProfileDir;

	// Add the value to yargs arguments.
	parsed["profile-dir"] = selectedProfileDir;
	parsed["profileDir"] = selectedProfileDir;

	// Add the value to exported options.
	exports["profile-dir"] = selectedProfileDir;
	exports["profileDir"] = selectedProfileDir;
};

exports.knownOpts = knownOpts;
exports.shorthands = shorthands;

Object.keys(parsed).forEach((opt) => {
	var key: string = (shorthands[opt]) || opt;
	exports[key] =  (typeof (parsed[opt]) === "number") ? parsed[opt].toString() :  parsed[opt];
});

declare var exports: any;
export = exports;
