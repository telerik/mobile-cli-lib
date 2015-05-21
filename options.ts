///<reference path="../.d.ts"/>
"use strict";
import path = require("path");
import util = require("util");
import helpers = require("./helpers");
import yargs = require("yargs");

export enum OptionType {
	String,
	Boolean,
	Number,
	Array
}

export class OptionsBase {
	private optionsWhiteList = ["ui", "recursive", "reporter", "require", "timeout", "_", "$0"]; // These options shouldn't be validated
	private _parsed: any[];
	public argv: IYargArgv;

	constructor(public options: IDictionary<yargs.IOption>,
		public defaultProfileDir: string,
		private $errors: IErrors,
		private $staticConfig: IStaticConfig) {
			
		_.extend(this.options, this.commonOptions);

		yargs.options(this.options);
		this.argv = yargs.argv;

		this.argv["profileDir"] = this.argv["profileDir"] || this.defaultProfileDir;		

		_.each(this.optionNames, optionName => {
			Object.defineProperty(OptionsBase.prototype, optionName, {
				configurable: true,
				get: function () {
					return this.getOptionValue(optionName);
				},
				set: function(value: any) {
					this.argv[optionName] = value;
				}
			});
		});
	}
	
	public get shorthands(): string[] {
		var result: string[] = [];
		_.each(_.keys(this.options), optionName => {
			if(this.options[optionName].alias) {
				result.push(this.options[optionName].alias)
			}
		});
		return result;
	}

	private get commonOptions(): IDictionary<yargs.IOption> {
		return {
			"log": { type: OptionType.String },
			"verbose": { type: OptionType.Boolean, alias: "v" },
			"path": { type: OptionType.String, alias: "p" },
			"version": { type: OptionType.Boolean },
			"help": { type: OptionType.Boolean, alias: "h" },
			"json": { type: OptionType.Boolean },
			"watch": { type: OptionType.Boolean },
			"avd": { type: OptionType.String },
			"profileDir": { type: OptionType.String },
			"timeout": { type: OptionType.String },
			"device": { type: OptionType.String },
			"availableDevices": { type: OptionType.Boolean },
			"appid": { type: OptionType.String },
			"geny": { type: OptionType.String },
			"debugBrk": { type: OptionType.Boolean },
			"debugPort": {type: OptionType.Number },
			"getPort": { type: OptionType.Boolean },
			"start": { type: OptionType.Boolean },
			"stop": { type: OptionType.Boolean },
			"ddi": { type: OptionType.String }, // the path to developer  disk image
			"justlaunch": { type: OptionType.Boolean }
		}
	}

	private get optionNames(): string[] {
		return _.keys(this.options);
	}

	private getOptionValue(optionName: string): any {
		optionName = this.getCorrectOptionName(optionName);
		let result = typeof this.argv[optionName] === "number" ? this.argv[optionName].toString() : this.argv[optionName];
		
		let optionType = this.getOptionType(optionName);
		if(optionType === OptionType.Array && typeof result === "string") {
			return [result];
		} 
		
		return result;
	}

	public validateOptions(): void {
		let parsed = Object.create(null);
		_.each(_.keys(this.argv), optionName => parsed[optionName] = this.getOptionValue(optionName));
		_.each(_.keys(parsed), (originalOptionName:string) => {
			let optionName = this.getCorrectOptionName(originalOptionName);

			if (!_.contains(this.optionsWhiteList, optionName)) {
				
				if (!this.isOptionSupported(optionName)) {
					this.$errors.failWithoutHelp("The option '%s' is not supported. To see command's options, use '$ %s help %s'. To see all commands use '$ %s help'.", originalOptionName, this.$staticConfig.CLIENT_NAME.toLowerCase(), process.argv[2], this.$staticConfig.CLIENT_NAME.toLowerCase());
				} 
				
				let optionType = this.getOptionType(optionName);
				let optionValue = parsed[optionName];
				let parsedOptionType = typeof (optionValue);
				
				if (_.isArray(optionValue) && optionType !== OptionType.Array) {
					this.$errors.failWithoutHelp("You have set the %s option multiple times. Check the correct command syntax below and try again.", originalOptionName);
				} else if (this.doesOptionRequireValue(optionType, parsedOptionType)) {
					this.$errors.failWithoutHelp("The option '%s' requires a value.", originalOptionName);
				} else if (optionType === OptionType.String && helpers.isNullOrWhitespace(optionValue)) {
					this.$errors.failWithoutHelp("The option '%s' requires non-empty value.", originalOptionName);
				} else if (optionType === OptionType.Boolean && parsedOptionType !== 'boolean') {
					this.$errors.failWithoutHelp("The option '%s' does not accept values.", originalOptionName);
				}
			}
		});
	}
	
	private getCorrectOptionName(optionName: string): string {
		let secondaryOptionName = this.getSecondaryOptionName(optionName);
		return _.contains(this.optionNames, secondaryOptionName) ? secondaryOptionName : optionName;
	}
	
	private getOptionType(optionName: string) {
		var option = this.options[optionName] || this.tryGetOptionByAliasName(optionName);
		 return option ? option.type : ""
	}
	
	private tryGetOptionByAliasName(aliasName: string) {
		let option = _.find(this.options, opt => opt.alias === aliasName);
		return option;
	}
	
	private isOptionSupported(option: string): boolean {
		if(!this.options[option]) {
			let opt = this.tryGetOptionByAliasName(option);
			return !!opt;
		}

		return true;
	}

	private doesOptionRequireValue(optionType: OptionType, parsedOptionType: string): boolean {
		return optionType !== OptionType.Boolean && parsedOptionType === 'boolean';
	}

// If you pass value with dash, yargs adds it to yargs.argv in two ways:
// with dash and without dash, replacing first symbol after it with its toUpper equivalent
// ex, "$ <cli name> emulate android --profile-dir" will add profile-dir to yargs.argv as profile-dir and profileDir
// IMPORTANT: In your code, it is better to use the value without dashes (profileDir in the example).
// This way your code will work in case "$ <cli name> emulate android --profile-dir" or "$ <cli name> emulate android --profileDir" is used by user.
	private getSecondaryOptionName(optionName: string): string {
		let matchUpperCaseLetters = optionName.match(/(.+?)([-])([a-zA-Z])(.*)/);
		if(matchUpperCaseLetters) {
			// get here if option with upperCase letter is specified, for example profileDir
			// check if in knownOptions we have its kebabCase presentation
			let secondaryOptionName = util.format("%s%s%s", matchUpperCaseLetters[1], matchUpperCaseLetters[3].toUpperCase(), matchUpperCaseLetters[4] || '');
			return this.getSecondaryOptionName(secondaryOptionName);
		}

		return optionName;
	}
}
