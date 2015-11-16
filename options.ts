///<reference path=".d.ts"/>
"use strict";
import * as util from "util";
import * as helpers from "./helpers";
import * as yargs from "yargs";

export class OptionType {
	public static String = "string";
	public static Boolean = "boolean";
	public static Number = "number";
	public static Array = "array";
	public static Object = "object";
}

export class OptionsBase {
	private optionsWhiteList = ["ui", "recursive", "reporter", "require", "timeout", "_", "$0"]; // These options shouldn't be validated
	public argv: IYargArgv;
	private static GLOBAL_OPTIONS: IDictionary<IDashedOption> = {
		"log": { type: OptionType.String },
		"verbose": { type: OptionType.Boolean, alias: "v" },
		"version": { type: OptionType.Boolean },
		"help": { type: OptionType.Boolean, alias: "h" },
		"profileDir": { type: OptionType.String },
		"analyticsClient": {type: OptionType.String},
		"path": { type: OptionType.String, alias: "p" },
		// This will parse all non-hyphenated values as strings.
		"_": { type: OptionType.String }
	};

	constructor(public options: IDictionary<IDashedOption>,
		public defaultProfileDir: string,
		private $errors: IErrors,
		private $staticConfig: Config.IStaticConfig) {

		_.extend(this.options, this.commonOptions, OptionsBase.GLOBAL_OPTIONS);
		this.setArgv();
	}

	public get shorthands(): string[] {
		let result: string[] = [];
		_.each(_.keys(this.options), optionName => {
			if(this.options[optionName].alias) {
				result.push(this.options[optionName].alias);
			}
		});
		return result;
	}

	private get commonOptions(): IDictionary<IDashedOption> {
		return {
			"json": { type: OptionType.Boolean },
			"watch": { type: OptionType.Boolean },
			"avd": { type: OptionType.String },
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
			"justlaunch": { type: OptionType.Boolean },
			"file": { type: OptionType.String },
			"force": { type: OptionType.Boolean, alias: "f" },
			"companion": { type: OptionType.Boolean },
			"emulator": { type: OptionType.Boolean },
			"sdk": { type: OptionType.String },
			var: {type: OptionType.Object},
			default: {type: OptionType.Boolean},
		};
	}

	private get optionNames(): string[] {
		return _.keys(this.options);
	}

	private getOptionValue(optionName: string): any {
		optionName = this.getCorrectOptionName(optionName);
		return this.argv[optionName];
	}

	public validateOptions(commandSpecificDashedOptions?: IDictionary<IDashedOption>): void {
		if(commandSpecificDashedOptions) {
			this.options = OptionsBase.GLOBAL_OPTIONS;
			_.extend(this.options, commandSpecificDashedOptions);
			this.setArgv();
		}

		let parsed = Object.create(null);
		// DO NOT REMOVE { } as when they are missing and some of the option values is false, the each stops as it thinks we have set "return false".
		_.each(_.keys(this.argv), optionName => {
			parsed[optionName] = this.getOptionValue(optionName);
		});

		_.each(parsed, (value:any, originalOptionName:string) => {
			// when this.options are passed to yargs, it returns all of them and the ones that are not part of process.argv are set to undefined.
			if(value === undefined) {
				return;
			}

			let optionName = this.getCorrectOptionName(originalOptionName);

			if (!_.contains(this.optionsWhiteList, optionName)) {
				if (!this.isOptionSupported(optionName)) {
					this.$errors.failWithoutHelp(`The option '${originalOptionName}' is not supported. To see command's options, use '$ ${this.$staticConfig.CLIENT_NAME.toLowerCase()} help ${process.argv[2]}'. To see all commands use '$ ${this.$staticConfig.CLIENT_NAME.toLowerCase()} help'.`);
				}
				let optionType = this.getOptionType(optionName);
				let optionValue = parsed[optionName];
				if (_.isArray(optionValue) && optionType !== OptionType.Array) {
					this.$errors.fail("You have set the %s option multiple times. Check the correct command syntax below and try again.", originalOptionName);
				} else if (optionType === OptionType.String && helpers.isNullOrWhitespace(optionValue)) {
					this.$errors.failWithoutHelp("The option '%s' requires non-empty value.", originalOptionName);
				} else if(optionType === OptionType.Array && optionValue.length === 0) {
					this.$errors.failWithoutHelp(`The option '${originalOptionName}' requires one or more values, separated by a space.`);
				}
			}
		});
	}

	private getCorrectOptionName(optionName: string): string {
		let secondaryOptionName = this.getSecondaryOptionName(optionName);
		return _.contains(this.optionNames, secondaryOptionName) ? secondaryOptionName : optionName;
	}

	private getOptionType(optionName: string): string {
		let option = this.options[optionName] || this.tryGetOptionByAliasName(optionName);
		return option ? option.type : "";
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

	private setArgv(): void {
		this.argv = yargs(process.argv.slice(2)).options(this.options).argv;
		this.adjustDashedOptions();
	}

	private adjustDashedOptions(): void {
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
}
