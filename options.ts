///<reference path="../.d.ts"/>
"use strict";
import path = require("path");
import helpers = require("./../common/helpers");

var knownOpts:any = {
		"log" : String,
		"verbose" : Boolean,
		"path" : String,
		"version": Boolean,
		"help": Boolean,
		"json": Boolean,
		"watch": Boolean,
		"avd": String
	},
	shorthands = {
		"v" : "verbose",
		"p" : "path"
	};

var parsed = helpers.getParsedOptions(knownOpts, shorthands);

Object.keys(parsed).forEach((opt) => exports[opt] = parsed[opt]);

exports.knownOpts = knownOpts;

declare var exports:any;
export = exports;