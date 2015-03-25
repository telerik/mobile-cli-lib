///<reference path="../../.d.ts"/>
"use strict";

import util = require("util");
import Future = require("fibers/future");
import path = require("path");
import options = require("options");
import marked = require("marked");
var TerminalRenderer = require('marked-terminal');
var chalk = require("chalk");

export class HtmlHelpService implements IHtmlHelpService {
	private static MARKDOWN_FILE_EXTENSION = ".md";
	private static HTML_FILE_EXTENSION = ".html";
	private static MAN_PAGE_NAME_PLACEHOLDER = "@MAN_PAGE_NAME@";
	private static HTML_COMMAND_HELP_PLACEHOLDER = "@HTML_COMMAND_HELP@";
	private static RELATIVE_PATH_TO_STYLES_CSS_PLACEHOLDER = "@RELATIVE_PATH_TO_STYLES_CSS@";

	private pathToManPages: string;
	private pathToHtmlPages: string;
	private get pathToStylesCss(): string {
		return path.join(this.$staticConfig.HTML_HELPERS_DIR, "styles.css");
	}

	private get pathToBasicPage(): string {
		return path.join(this.$staticConfig.HTML_HELPERS_DIR, "basic-page.html");
	}

	constructor(private $logger: ILogger,
		private $injector: IInjector,
		private $errors: IErrors,
		private $fs: IFileSystem,
		private $staticConfig: Config.IStaticConfig,
		private $microTemplateService: IMicroTemplateService,
		private $opener: IOpener) {
		this.pathToHtmlPages = this.$staticConfig.HTML_PAGES_DIR;
		this.pathToManPages = this.$staticConfig.MAN_PAGES_DIR;
	}

	public generateHtmlPages(): IFuture<void> {
		return (() => {
			var mdFiles = this.$fs.enumerateFilesInDirectorySync(this.pathToManPages);
			var basicHtmlPage = this.$fs.readFile(this.pathToBasicPage).wait().toString();
			var futures = _.map(mdFiles, markdownFile => this.createHtmlPage(basicHtmlPage, markdownFile));
			Future.wait(futures);
			this.$logger.trace("Finished generating HTML files.");
		}).future<void>()();
	}

	private createHtmlPage(basicHtmlPage: string, pathToMdFile: string): IFuture<void> {
		return (() => {
			var mdFileName = path.basename(pathToMdFile);
			var htmlFileName = mdFileName.replace(HtmlHelpService.MARKDOWN_FILE_EXTENSION, HtmlHelpService.HTML_FILE_EXTENSION);
			this.$logger.trace("Generating '%s' help topic.", htmlFileName);

			var helpText = this.$fs.readText(pathToMdFile).wait();
			var outputText = this.$microTemplateService.parseContent(helpText, { isHtml: true });
			var htmlText = marked(outputText);

			var filePath = pathToMdFile
				.replace(path.basename(this.pathToManPages), path.basename(this.pathToHtmlPages))
				.replace(mdFileName, htmlFileName);
			this.$logger.trace("HTML file path for '%s' man page is: '%s'.", mdFileName, filePath);

			var outputHtml = basicHtmlPage
				.replace(HtmlHelpService.MAN_PAGE_NAME_PLACEHOLDER, mdFileName.replace(HtmlHelpService.MARKDOWN_FILE_EXTENSION, ""))
				.replace(HtmlHelpService.HTML_COMMAND_HELP_PLACEHOLDER, htmlText)
				.replace(HtmlHelpService.RELATIVE_PATH_TO_STYLES_CSS_PLACEHOLDER, path.relative(path.dirname(filePath), this.pathToStylesCss));

			this.$fs.writeFile(filePath, outputHtml).wait();
			this.$logger.trace("Finished writing file '%s'.", filePath);
		}).future<void>()();
	}

	public openHelpForCommandInBrowser(commandName: string): IFuture<void> {
		return ((): void => {
			var htmlPage = this.convertCommandNameToFileName(commandName) + HtmlHelpService.HTML_FILE_EXTENSION;
			this.$logger.trace("Opening help for command '%s'. FileName is '%s'.", commandName, htmlPage);
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
		var defaultCommandMatch = commandName.match(/(\w+?)\|\*/);
		if(defaultCommandMatch) {
			this.$logger.trace("Default command found. Replace current command name '%s' with '%s'.", commandName, defaultCommandMatch[1]);
			commandName = defaultCommandMatch[1];
		}

		var availableCommands = this.$injector.getRegisteredCommandsNames(false).sort();
		this.$logger.trace("List of registered commands: %s", availableCommands.join(", "));
		if(commandName && !_.contains(availableCommands, commandName)) {
			this.$errors.failWithoutHelp("Unknown command '%s'. Try '$ %s help' for a full list of supported commands.", commandName, this.$staticConfig.CLIENT_NAME.toLowerCase());
		}

		return commandName.replace(/\|/g, "-") || "index";
	}
	
	private tryOpeningSelectedPage(htmlPage: string): boolean {
		var fileList = this.$fs.enumerateFilesInDirectorySync(this.pathToHtmlPages);
		this.$logger.trace("File list: " + fileList);
		var pageToOpen = _.find(fileList, file => path.basename(file) === htmlPage);
		
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
			var mdFileName = this.convertCommandNameToFileName(commandName) + HtmlHelpService.MARKDOWN_FILE_EXTENSION;
			this.$logger.trace("Reading help for command '%s'. FileName is '%s'.", commandName, mdFileName);

			var markdownFile = _.find(this.$fs.enumerateFilesInDirectorySync(this.pathToManPages), file => path.basename(file) === mdFileName);
			if(markdownFile) {
				return this.$fs.readText(markdownFile).wait();
			} 

			this.$errors.failWithoutHelp("Unknown command '%s'. Try '$ %s help' for a full list of supported commands.", mdFileName.replace(".md", ""), this.$staticConfig.CLIENT_NAME.toLowerCase());
		}).future<string>()();
	}

	public getCommandLineHelpForCommand(commandName: string): IFuture<string> {
		return ((): string => {
			var helpText = this.readMdFileForCommand(commandName).wait();
			var outputText = this.$microTemplateService.parseContent(helpText, { isHtml: false });
			var opts = {
				unescape: true,
				link: chalk.red
				// TODO: Use tableOptions when marked-terminal officialy supports them.
				// tableOptions: { colWidths: [20,50] }
			};

			marked.setOptions({ renderer: new TerminalRenderer(opts) });
			var parsedMarkdown = marked(outputText);
			// Fix issue inside marked-terminal when table contains < >.
			// Check https://github.com/mikaelbr/marked-terminal/issues/12 for more details.
			// Do not remove spaces before < and after > - they are required for correct rendering of cli-table
			// as the width of columns is calculated with 4 symbols (&lt;), so we should replace values with correct ones with same length
			return parsedMarkdown
				.replace(/\&lt;/g, "   <")
				.replace(/\&gt;/g, ">   ");
		}).future<string>()();
	}
}
$injector.register("htmlHelpService", HtmlHelpService);
