///<reference path="../.d.ts"/>

import Future = require("fibers/future");
import prompt = require("inquirer");
import helpers = require("./helpers");
import readline = require("readline");
var MuteStream = require("mute-stream");

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
			var mutestream = new MuteStream();
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
		var future = new Future;
		prompt.prompt(schema, (result: any) => {
			if(result) {
				future.return(result);
			} else {
				future.throw(result);
			}
		});
		return future;
	}

	public getPassword(prompt: string, options?: {allowEmpty?: boolean}): IFuture<string> {
		return (() => {
			var schema: IPromptSchema = {
				message: prompt,
				type: "password",
				name: "password",
				validate: (value: any) => {
					var allowEmpty = options && options.allowEmpty;
					return (!allowEmpty && !value) ? "Password must be non-empty" : true;
				}
			};

			var result = this.get([schema]).wait();
			return result.password;
		}).future<string>()();
	}

	public getString(prompt: string): IFuture<string> {
		return (() => {
			var schema: IPromptSchema = {
				message: prompt,
				type: "input",
				name: "inputString"
			};

			var result = this.get([schema]).wait();
			return result.inputString;
		}).future<string>()();
	}

	public promptForChoice(promptMessage: string, choices: any[]): IFuture<string> {
		return (() => {
			var schema: IPromptSchema = {
				message: promptMessage,
				type: "list",
				name: "userAnswer",
				choices: choices
			};

			var result = this.get([schema]).wait();
			return result.userAnswer;
		}).future<string>()();
	}

	public confirm(prompt: string, defaultAction?: () => boolean): IFuture<boolean> {
		return ((): boolean => {
			var schema = {
				type: "confirm",
				name: "prompt",
				default: defaultAction,
				message: prompt
			};

			var result = this.get([schema]).wait();
			return result.prompt;
		}).future<boolean>()();
	}
}
$injector.register("prompter", Prompter);