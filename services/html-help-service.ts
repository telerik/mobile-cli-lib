///<reference path="../../.d.ts"/>
"use strict";

import util = require("util");
import Future = require("fibers/future");
import path = require("path");
import marked = require("marked");
let TerminalRenderer = require('marked-terminal');
let chalk = require("chalk");

export class HtmlHelpService implements IHtmlHelpService {
	private static MARKDOWN_FILE_EXTENSION = ".md";
	private static HTML_FILE_EXTENSION = ".html";
	private static MAN_PAGE_NAME_REGEX = /@MAN_PAGE_NAME@/g;
	private static HTML_COMMAND_HELP_REGEX = /@HTML_COMMAND_HELP@/g;
	private static RELATIVE_PATH_TO_STYLES_CSS_REGEX = /@RELATIVE_PATH_TO_STYLES_CSS@/g;
	private static RELATIVE_PATH_TO_IMAGES_REGEX = /@RELATIVE_PATH_TO_IMAGES@/g;
	private static RELATIVE_PATH_TO_INDEX_REGEX = /@RELATIVE_PATH_TO_INDEX@/g;
	private static MARKDOWN_LINK_REGEX = /\[([\w -`<>]+?)\]\([\s\S]*?\)/g;

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

	public generateHtmlPages(): IFuture<void> {
		return (() => {
			let mdFiles = this.$fs.enumerateFilesInDirectorySync(this.pathToManPages);
			let basicHtmlPage = this.$fs.readFile(this.pathToBasicPage).wait().toString();
			let futures = _.map(mdFiles, markdownFile => this.createHtmlPage(basicHtmlPage, markdownFile));
			Future.wait(futures);
			this.$logger.trace("Finished generating HTML files.");
		}).future<void>()();
	}

	private createHtmlPage(basicHtmlPage: string, pathToMdFile: string): IFuture<void> {
		return (() => {
			let mdFileName = path.basename(pathToMdFile);
			let htmlFileName = mdFileName.replace(HtmlHelpService.MARKDOWN_FILE_EXTENSION, HtmlHelpService.HTML_FILE_EXTENSION);
			this.$logger.trace("Generating '%s' help topic.", htmlFileName);

			let helpText = this.$fs.readText(pathToMdFile).wait();
			let outputText = this.$microTemplateService.parseContent(helpText, { isHtml: true });
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

			this.$fs.writeFile(filePath, outputHtml).wait();
			this.$logger.trace("Finished writing file '%s'.", filePath);
		}).future<void>()();
	}

	public openHelpForCommandInBrowser(commandName: string): IFuture<void> {
		return ((): void => {
			let htmlPage = this.convertCommandNameToFileName(commandName) + HtmlHelpService.HTML_FILE_EXTENSION;
			this.$logger.trace("Opening help for command '%s'. FileName is '%s'.", commandName, htmlPage);

			this.$fs.ensureDirectoryExists(this.pathToHtmlPages).wait();
			if(!this.tryOpeningSelectedPage(htmlPage)) {
				// HTML pages may have been skipped on post-install, lets generate them.
				this.$logger.trace("Required HTML file '%s' is missing. Let's try generating HTML files and see if we'll find it.", htmlPage);
				this.generateHtmlPages().wait();
				if(!this.tryOpeningSelectedPage(htmlPage)) {
					this.$errors.failWithoutHelp("Unable to find help for '%s'", commandName);
				}
			}
		}).future<void>()();
	}

	private convertCommandNameToFileName(commandName: string): string {
		let defaultCommandMatch = commandName.match(/(\w+?)\|\*/);
		if(defaultCommandMatch) {
			this.$logger.trace("Default command found. Replace current command name '%s' with '%s'.", commandName, defaultCommandMatch[1]);
			commandName = defaultCommandMatch[1];
		}

		let availableCommands = this.$injector.getRegisteredCommandsNames(false).sort();
		this.$logger.trace("List of registered commands: %s", availableCommands.join(", "));
		if(commandName && _.startsWith(commandName, this.$commandsServiceProvider.dynamicCommandsPrefix) && !_.contains(availableCommands, commandName)) {
			let dynamicCommands = this.$commandsServiceProvider.getDynamicCommands().wait();
			if(!_.contains(dynamicCommands, commandName)) {
				this.$errors.failWithoutHelp("Unknown command '%s'. Try '$ %s help' for a full list of supported commands.", commandName, this.$staticConfig.CLIENT_NAME.toLowerCase());
			}
		}

		return commandName.replace(/\|/g, "-") || "index";
	}
	
	private tryOpeningSelectedPage(htmlPage: string): boolean {
		let fileList = this.$fs.enumerateFilesInDirectorySync(this.pathToHtmlPages);
		this.$logger.trace("File list: " + fileList);
		let pageToOpen = _.find(fileList, file => path.basename(file) === htmlPage);
		
		if(pageToOpen) {
			this.$logger.trace("Found page to open: '%s'", pageToOpen);
			this.$opener.open(pageToOpen);
			return true;
		} 
		
		this.$logger.trace("Unable to find file: '%s'", htmlPage);
		return false;
	}

	private readMdFileForCommand(commandName: string): IFuture<string> {
		return ((): string => {
			let mdFileName = this.convertCommandNameToFileName(commandName) + HtmlHelpService.MARKDOWN_FILE_EXTENSION;
			this.$logger.trace("Reading help for command '%s'. FileName is '%s'.", commandName, mdFileName);

			let markdownFile = _.find(this.$fs.enumerateFilesInDirectorySync(this.pathToManPages), file => path.basename(file) === mdFileName);
			if(markdownFile) {
				return this.$fs.readText(markdownFile).wait();
			} 

			this.$errors.failWithoutHelp("Unknown command '%s'. Try '$ %s help' for a full list of supported commands.", mdFileName.replace(".md", ""), this.$staticConfig.CLIENT_NAME.toLowerCase());
		}).future<string>()();
	}

	public getCommandLineHelpForCommand(commandName: string): IFuture<string> {
		return ((): string => {
			let helpText = this.readMdFileForCommand(commandName).wait();
			let outputText = this.$microTemplateService.parseContent(helpText, { isHtml: false })
				.replace(/&nbsp;/g, " ")
				.replace(HtmlHelpService.MARKDOWN_LINK_REGEX, "$1");

			let opts = {
				unescape: true,
				link: chalk.red,
				tableOptions: {
					chars: { 'mid': '', 'left-mid': '', 'mid-mid': '', 'right-mid': '' },
					style: {
						'padding-left': 1,
						'padding-right': 1,
						head: ['green', 'bold'],
						border: ['grey'],
						compact: false
					}
				}
			};

			marked.setOptions({ renderer: new TerminalRenderer(opts) });
			return marked(outputText);
		}).future<string>()();
	}
}
$injector.register("htmlHelpService", HtmlHelpService);
