import { Block } from "../codeGeneration/code-entity";
import { CodePrinter } from "../codeGeneration/code-printer";

export class MessageContractGenerator implements IServiceContractGenerator {
	private pendingModels: any;

	constructor(private $fs: IFileSystem,
		private $messagesService: IMessagesService,
		private $staticConfig: Config.IStaticConfig) {
		this.pendingModels = {};
	}

	public async generate(): Promise<IServiceContractClientCode> {
		let interfacesFile = new Block();
		let implementationsFile = new Block();

		implementationsFile.writeLine("//");
		implementationsFile.writeLine("// automatically generated code; do not edit manually!");
		implementationsFile.writeLine("//");
		implementationsFile.writeLine("");

		interfacesFile.writeLine("//");
		interfacesFile.writeLine("// automatically generated code; do not edit manually!");
		interfacesFile.writeLine("//");

		let messagesClass = new Block("export class Messages implements IMessages");
		let messagesInterface = new Block("interface IMessages");

		_.each(this.$messagesService.pathsToMessageJsonFiles, jsonFilePath => {
			let jsonContents = this.$fs.readJson(jsonFilePath),
				implementationBlock: CodeGeneration.IBlock = new Block(),
				interfaceBlock: CodeGeneration.IBlock = new Block();

			this.generateFileRecursive(jsonContents, "", implementationBlock, 0, { shouldGenerateInterface: false });
			this.generateFileRecursive(jsonContents, "", interfaceBlock, 0, { shouldGenerateInterface: true });
			messagesClass.addBlock(implementationBlock);
			messagesInterface.addBlock(interfaceBlock);
		});

		interfacesFile.addBlock(messagesInterface);

		implementationsFile.addBlock(messagesClass);
		implementationsFile.writeLine("$injector.register('messages', Messages);");

		let codePrinter = new CodePrinter();
		return {
			interfaceFile: codePrinter.composeBlock(interfacesFile),
			implementationFile: codePrinter.composeBlock(implementationsFile)
		};
	}

	private generateFileRecursive(jsonContents: any, propertyValue: string, block: CodeGeneration.IBlock, depth: number, options: { shouldGenerateInterface: boolean }): void {
		_.each(jsonContents, (val: any, key: string) => {
			let newPropertyValue = propertyValue + key,
				separator = options.shouldGenerateInterface || depth ? ":" : "=",
				endingSymbol = options.shouldGenerateInterface || !depth ? ";" : ",";

			if (typeof val === "string") {
				let actualValue = options.shouldGenerateInterface ? "string" : `"${newPropertyValue}"`;

				block.writeLine(`${key}${separator} ${actualValue}${endingSymbol}`);
				newPropertyValue = propertyValue;
				return;
			}

			let newBlock = new Block(`${key} ${separator} `);
			newBlock.endingCharacter = endingSymbol;
			this.generateFileRecursive(val, newPropertyValue + ".", newBlock, depth + 1, options);
			block.addBlock(newBlock);
		});
	}
}
$injector.register("messageContractGenerator", MessageContractGenerator);
