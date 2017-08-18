import * as path from "path";
import marked = require("marked");

export class HtmlHelpService implements IHtmlHelpService {
	private static MARKDOWN_FILE_EXTENSION = ".md";
	private static HTML_FILE_EXTENSION = ".html";
	private static MAN_PAGE_NAME_REGEX = /@MAN_PAGE_NAME@/g;
	private static HTML_COMMAND_HELP_REGEX = /@HTML_COMMAND_HELP@/g;
	private static RELATIVE_PATH_TO_STYLES_CSS_REGEX = /@RELATIVE_PATH_TO_STYLES_CSS@/g;
	private static RELATIVE_PATH_TO_IMAGES_REGEX = /@RELATIVE_PATH_TO_IMAGES@/g;
	private static RELATIVE_PATH_TO_INDEX_REGEX = /@RELATIVE_PATH_TO_INDEX@/g;
	private static MARKDOWN_LINK_REGEX = /\[([\w \-\`\<\>\*\:\\]+?)\]\([\s\S]+?\)/g;
	private static SPAN_REGEX = /([\s\S]*?)<span.*?>([\s\S]*?)<\/span>(?:\r?\n)*/g;
	private get newLineRegex(): RegExp {
		return /\r?\n/g;
	}

	private pathToManPages: string;
	private pathToHtmlPages: string;
	private get pathToStylesCss(): string {
		return path.join(this.$staticConfig.HTML_COMMON_HELPERS_DIR, "styles.css");
	}

	private get pathToBasicPage(): string {
		return path.join(this.$staticConfig.HTML_COMMON_HELPERS_DIR, "basic-page.html");
	}

	private pathToImages = this.$staticConfig.HTML_CLI_HELPERS_DIR;
	private get pathToIndexHtml(): string {
		return path.join(this.$staticConfig.HTML_PAGES_DIR, "index.html");
	}

	constructor(private $logger: ILogger,
		private $injector: IInjector,
		private $errors: IErrors,
		private $fs: IFileSystem,
		private $staticConfig: Config.IStaticConfig,
		private $microTemplateService: IMicroTemplateService,
		private $opener: IOpener,
		private $commandsServiceProvider: ICommandsServiceProvider) {
		this.pathToHtmlPages = this.$staticConfig.HTML_PAGES_DIR;
		this.pathToManPages = this.$staticConfig.MAN_PAGES_DIR;
	}

	public async generateHtmlPages(): Promise<void> {
		let mdFiles = this.$fs.enumerateFilesInDirectorySync(this.pathToManPages);
		let basicHtmlPage = this.$fs.readText(this.pathToBasicPage);
		await Promise.all(_.map(mdFiles, markdownFile => this.createHtmlPage(basicHtmlPage, markdownFile)));
		this.$logger.trace("Finished generating HTML files.");
	}

	// This method should return Promise in order to generate all html pages simultaneously.
	private async createHtmlPage(basicHtmlPage: string, pathToMdFile: string): Promise<void> {
		let mdFileName = path.basename(pathToMdFile);
		let htmlFileName = mdFileName.replace(HtmlHelpService.MARKDOWN_FILE_EXTENSION, HtmlHelpService.HTML_FILE_EXTENSION);
		this.$logger.trace("Generating '%s' help topic.", htmlFileName);

		let helpText = this.$fs.readText(pathToMdFile);
		let outputText = await this.$microTemplateService.parseContent(helpText, { isHtml: true });
		let htmlText = marked(outputText);

		let filePath = pathToMdFile
			.replace(path.basename(this.pathToManPages), path.basename(this.pathToHtmlPages))
			.replace(mdFileName, htmlFileName);
		this.$logger.trace("HTML file path for '%s' man page is: '%s'.", mdFileName, filePath);

		let outputHtml = basicHtmlPage
			.replace(HtmlHelpService.MAN_PAGE_NAME_REGEX, mdFileName.replace(HtmlHelpService.MARKDOWN_FILE_EXTENSION, ""))
			.replace(HtmlHelpService.HTML_COMMAND_HELP_REGEX, htmlText)
			.replace(HtmlHelpService.RELATIVE_PATH_TO_STYLES_CSS_REGEX, path.relative(path.dirname(filePath), this.pathToStylesCss))
			.replace(HtmlHelpService.RELATIVE_PATH_TO_IMAGES_REGEX, path.relative(path.dirname(filePath), this.pathToImages))
			.replace(HtmlHelpService.RELATIVE_PATH_TO_INDEX_REGEX, path.relative(path.dirname(filePath), this.pathToIndexHtml));

		this.$fs.writeFile(filePath, outputHtml);
		this.$logger.trace("Finished writing file '%s'.", filePath);
	}

	public async openHelpForCommandInBrowser(commandName: string): Promise<void> {
		let htmlPage = await this.convertCommandNameToFileName(commandName) + HtmlHelpService.HTML_FILE_EXTENSION;
		this.$logger.trace("Opening help for command '%s'. FileName is '%s'.", commandName, htmlPage);

		this.$fs.ensureDirectoryExists(this.pathToHtmlPages);
		if (!this.tryOpeningSelectedPage(htmlPage)) {
			// HTML pages may have been skipped on post-install, lets generate them.
			this.$logger.trace("Required HTML file '%s' is missing. Let's try generating HTML files and see if we'll find it.", htmlPage);
			await this.generateHtmlPages();
			if (!this.tryOpeningSelectedPage(htmlPage)) {
				this.$errors.failWithoutHelp("Unable to find help for '%s'", commandName);
			}
		}
	}

	private async convertCommandNameToFileName(commandName: string): Promise<string> {
		let defaultCommandMatch = commandName.match(/(\w+?)\|\*/);
		if (defaultCommandMatch) {
			this.$logger.trace("Default command found. Replace current command name '%s' with '%s'.", commandName, defaultCommandMatch[1]);
			commandName = defaultCommandMatch[1];
		}

		let availableCommands = this.$injector.getRegisteredCommandsNames(true).sort();
		this.$logger.trace("List of registered commands: %s", availableCommands.join(", "));
		if (commandName && _.startsWith(commandName, this.$commandsServiceProvider.dynamicCommandsPrefix) && !_.includes(availableCommands, commandName)) {
			let dynamicCommands = await this.$commandsServiceProvider.getDynamicCommands();
			if (!_.includes(dynamicCommands, commandName)) {
				this.$errors.failWithoutHelp("Unknown command '%s'. Try '$ %s help' for a full list of supported commands.", commandName, this.$staticConfig.CLIENT_NAME.toLowerCase());
			}
		}

		return commandName.replace(/\|/g, "-") || "index";
	}

	private tryOpeningSelectedPage(htmlPage: string): boolean {
		let fileList = this.$fs.enumerateFilesInDirectorySync(this.pathToHtmlPages);
		this.$logger.trace("File list: " + fileList);
		let pageToOpen = _.find(fileList, file => path.basename(file) === htmlPage);

		if (pageToOpen) {
			this.$logger.trace("Found page to open: '%s'", pageToOpen);
			this.$opener.open(pageToOpen);
			return true;
		}

		this.$logger.trace("Unable to find file: '%s'", htmlPage);
		return false;
	}

	private async readMdFileForCommand(commandName: string): Promise<string> {
		let mdFileName = await this.convertCommandNameToFileName(commandName) + HtmlHelpService.MARKDOWN_FILE_EXTENSION;
		this.$logger.trace("Reading help for command '%s'. FileName is '%s'.", commandName, mdFileName);

		let markdownFile = _.find(this.$fs.enumerateFilesInDirectorySync(this.pathToManPages), file => path.basename(file) === mdFileName);
		if (markdownFile) {
			return this.$fs.readText(markdownFile);
		}

		this.$errors.failWithoutHelp("Unknown command '%s'. Try '$ %s help' for a full list of supported commands.", mdFileName.replace(".md", ""), this.$staticConfig.CLIENT_NAME.toLowerCase());
	}

	public async getCommandLineHelpForCommand(commandName: string): Promise<string> {
		let helpText = await this.readMdFileForCommand(commandName);
		const commandLineHelp = (await this.$microTemplateService.parseContent(helpText, { isHtml: false }))
			.replace(/&nbsp;/g, " ")
			.replace(HtmlHelpService.MARKDOWN_LINK_REGEX, "$1")
			.replace(HtmlHelpService.SPAN_REGEX, (matchingSubstring: string, textBeforeSpan: string, textInsideSpan: string, index: number, fullString: string): string => {
				return textBeforeSpan.replace(this.newLineRegex, "") + textInsideSpan.replace(this.newLineRegex, "");
			});

		return commandLineHelp;
	}
}

$injector.register("htmlHelpService", HtmlHelpService);
