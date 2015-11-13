///<reference path="../.d.ts"/>
"use strict";
import * as path from "path";

export class GenerateMessages implements ICommand {
	private static MESSAGES_DEFINITIONS_FILE_NAME = "messages.d.ts";
	private static MESSAGES_IMPLEMENTATION_FILE_NAME = "messages.ts";

	constructor(private $fs: IFileSystem,
				private $messageContractGenerator: IServiceContractGenerator,
				private $staticConfig: Config.IStaticConfig) {
	}

	allowedParameters: ICommandParameter[] = [];

	execute(args: string[]): IFuture<void> {
		return (() => {
			let result = this.$messageContractGenerator.generate().wait(),
				outerMessagesDirectory = path.join(__dirname, "../messages"),
				innerMessagesDirectory = path.join(__dirname, "../.."),
				interfaceFilePath: string,
				implementationFilePath: string;

			if (this.$staticConfig.CLIENT_NAME) {
				interfaceFilePath = path.join(outerMessagesDirectory, GenerateMessages.MESSAGES_DEFINITIONS_FILE_NAME);
				implementationFilePath = path.join(outerMessagesDirectory, GenerateMessages.MESSAGES_IMPLEMENTATION_FILE_NAME);
			} else {
				interfaceFilePath = path.join(innerMessagesDirectory, GenerateMessages.MESSAGES_DEFINITIONS_FILE_NAME);
				implementationFilePath = path.join(innerMessagesDirectory, GenerateMessages.MESSAGES_IMPLEMENTATION_FILE_NAME);
			}

			this.$fs.writeFile(interfaceFilePath, result.interfaceFile).wait();
			this.$fs.writeFile(implementationFilePath, result.implementationFile).wait();
		}).future<void>()();
	}
}
$injector.registerCommand("dev-generate-messages", GenerateMessages);
