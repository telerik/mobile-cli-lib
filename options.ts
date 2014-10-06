///<reference path="../.d.ts"/>
"use strict";

import path = require("path");
import helpers = require("./../common/helpers");
import osenv = require("osenv");
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
	},
	shorthands = {
		"v": "verbose",
		"p": "path"
	};

var parsed = yargs.argv;
Object.keys(parsed).forEach((opt) => exports[opt] = parsed[opt]);
var defaultProfileDir = path.join(osenv.home(), ".appbuilder-cli");
exports["profile-dir"] = exports["profile-dir"] || defaultProfileDir;

exports.knownOpts = knownOpts;
exports.shorthands = shorthands
declare var exports:any;
export = exports;
