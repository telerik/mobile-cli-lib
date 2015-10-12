///<reference path="../.d.ts"/>
"use strict";
import * as path from "path";

export class GenerateMessages implements ICommand {
	constructor(private $fs: IFileSystem,
				private $messageContractGenerator: IServiceContractGenerator,
				private $staticConfig: Config.IStaticConfig) {
	}

	allowedParameters: ICommandParameter[] = [];

	execute(args: string[]): IFuture<void> {
		return (() => {
			let result = this.$messageContractGenerator.generate().wait(),
				interfaceFilePath = this.$staticConfig.CLIENT_NAME ? path.join(__dirname, "../../messages.d.ts") : path.join(__dirname, "../messages/messages.d.ts"),
				implementationFilePath = this.$staticConfig.CLIENT_NAME ? path.join(__dirname, "../../messages.ts") : path.join(__dirname, "../messages/messages.ts");

			this.$fs.writeFile(interfaceFilePath, result.interfaceFile).wait();
			this.$fs.writeFile(implementationFilePath, result.implementationFile).wait();
		}).future<void>()();
	}
}
$injector.registerCommand("dev-generate-messages", GenerateMessages);
