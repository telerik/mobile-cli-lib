///<reference path=".d.ts"/>
"use strict";
import Future = require("fibers/future");
import prompt = require("inquirer");
import * as helpers from "./helpers";
import readline = require("readline");
let MuteStream = require("mute-stream");

export class Prompter implements IPrompter {
	private ctrlcReader: readline.ReadLine;

	constructor() {
		prompt.message = "";
		prompt.delimiter = ":";
		prompt.colors = false;
		prompt.isDefaultValueEditable = true;

		if (helpers.isInteractive()) {
			process.stdin.setRawMode(true); // After setting rawMode to true, Ctrl+C doesn't work for non node.js events loop i.e device log command

			// We need to create mute-stream and to pass it as output to ctrlcReader
			// This will prevent the prompter to show the user's text twice on the console
			let mutestream = new MuteStream();
			mutestream.pipe(process.stdout);
			mutestream.mute();

			this.ctrlcReader = readline.createInterface(<any>{
				input: process.stdin,
				output: mutestream
			});

			this.ctrlcReader.on("SIGINT", () => process.exit());
		}
	}

	public dispose() {
		if (this.ctrlcReader) {
			this.ctrlcReader.close();
		}
	}

	public get(schema: IPromptSchema[]): IFuture<any> {
		let future = new Future;
		if (!helpers.isInteractive() && _.any(schema, s => !s.default)) {
			future.throw(new Error('Console is not interactive'));
		} else {
			prompt.prompt(schema, (result: any) => {
				if(result) {
					future.return(result);
				} else {
					future.throw(new Error(`Unable to get result from prompt: ${result}`));
				}
			});
		}
		return future;
	}

	public getPassword(prompt: string, options?: {allowEmpty?: boolean}): IFuture<string> {
		return (() => {
			let schema: IPromptSchema = {
				message: prompt,
				type: "password",
				name: "password",
				validate: (value: any) => {
					let allowEmpty = options && options.allowEmpty;
					return (!allowEmpty && !value) ? "Password must be non-empty" : true;
				}
			};

			let result = this.get([schema]).wait();
			return result.password;
		}).future<string>()();
	}

	public getString(prompt: string, defaultAction?: () => string): IFuture<string> {
		return (() => {
			let schema: IPromptSchema = {
				message: prompt,
				type: "input",
				name: "inputString"
			};
			
			if(defaultAction) {
				schema.default = defaultAction;
			}

			let result = this.get([schema]).wait();
			return result.inputString;
		}).future<string>()();
	}

	public promptForChoice(promptMessage: string, choices: any[]): IFuture<string> {
		return (() => {
			let schema: IPromptSchema = {
				message: promptMessage,
				type: "list",
				name: "userAnswer",
				choices: choices
			};

			let result = this.get([schema]).wait();
			return result.userAnswer;
		}).future<string>()();
	}

	public confirm(prompt: string, defaultAction?: () => boolean): IFuture<boolean> {
		return ((): boolean => {
			let schema = {
				type: "confirm",
				name: "prompt",
				default: defaultAction,
				message: prompt
			};

			let result = this.get([schema]).wait();
			return result.prompt;
		}).future<boolean>()();
	}
}
$injector.register("prompter", Prompter);
