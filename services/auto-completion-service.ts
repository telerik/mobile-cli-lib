///<reference path="../.d.ts"/>
"use strict";
import osenv = require("osenv");
import path = require("path");
import util = require("util");

export class AutoCompletionService implements IAutoCompletionService {
	private scriptsOk = true;
	private scriptsUpdated = false;
	private _completionShellScriptContent: string;
	private _shellProfiles: string[];
	private _cliRunCommandsFile: string;
	private static COMPLETION_START_COMMENT_PATTERN = "###-%s-completion-start-###"
	private static COMPLETION_END_COMMENT_PATTERN = "###-%s-completion-end-###"
	private static TABTAB_COMPLETION_START_REGEX_PATTERN = "###-begin-%s-completion-###";
	private static TABTAB_COMPLETION_END_REGEX_PATTERN = "###-end-%s-completion-###";

	constructor(private $fs: IFileSystem,
		private $childProcess: IChildProcess,
		private $logger: ILogger,
		private $staticConfig: Config.IStaticConfig,
		private $hostInfo: IHostInfo) { }

	public disableAnalytics = true;

	private get shellProfiles(): string[]{
		if(!this._shellProfiles) {
			this._shellProfiles = [];
			this._shellProfiles.push(this.getHomePath(".bash_profile"));
			this._shellProfiles.push(this.getHomePath(".bashrc"));
			this._shellProfiles.push(this.getHomePath(".zshrc")); // zsh - http://www.acm.uiuc.edu/workshops/zsh/startup_files.html
		}

		return this._shellProfiles;
	}

	private get cliRunCommandsFile(): string {
		if(!this._cliRunCommandsFile) {
			this._cliRunCommandsFile = this.getHomePath(util.format(".%src", this.$staticConfig.CLIENT_NAME.toLowerCase()));
			if(this.$hostInfo.isWindows) {
				// on Windows bash, file is incorrectly written as C:\Users\<username>, which leads to errors when trying to execute the script:
				// $ source ~/.bashrc
				// sh.exe": C:Usersusername.appbuilderrc: No such file or directory
				this._cliRunCommandsFile = this._cliRunCommandsFile.replace(/\\/g, "/");
			}
		}

		return this._cliRunCommandsFile;
	}

	private getTabTabObsoleteRegex(clientName: string): RegExp {
		let tabTabStartPoint = util.format(AutoCompletionService.TABTAB_COMPLETION_START_REGEX_PATTERN, clientName.toLowerCase());
		let tabTabEndPoint = util.format(AutoCompletionService.TABTAB_COMPLETION_END_REGEX_PATTERN, clientName.toLowerCase());
		let tabTabRegex = new RegExp(util.format("%s[\\s\\S]*%s", tabTabStartPoint, tabTabEndPoint));
		return tabTabRegex;
	}

	public removeObsoleteAutoCompletion(): IFuture<void> {
		return (() => {
			// In previous releases we were writing directly in .bash_profile, .bashrc, .zshrc and .profile - remove this old code
			let shellProfilesToBeCleared = this.shellProfiles;
			// Add .profile only here as we do not want new autocompletion in this file, but we have to remove our old code from it.
			shellProfilesToBeCleared.push(this.getHomePath(".profile"));
			shellProfilesToBeCleared.forEach(file => {
				try {
					let text = this.$fs.readText(file).wait();
					let newText = text.replace(this.getTabTabObsoleteRegex(this.$staticConfig.CLIENT_NAME), "");
					if(this.$staticConfig.CLIENT_NAME_ALIAS) {
						newText = newText.replace(this.getTabTabObsoleteRegex(this.$staticConfig.CLIENT_NAME_ALIAS), "");
					}

					if(newText !== text) {
						this.$logger.trace("Remove obsolete AutoCompletion from file %s.", file);
						this.$fs.writeFile(file, newText).wait();
					}
				} catch(error) {
					if(error.code !== "ENOENT") {
						this.$logger.trace("Error while trying to disable autocompletion for '%s' file. Error is:\n%s", error.toString());
					}
				}
			});
		}).future<void>()();
	}

	private get completionShellScriptContent() {
		if(!this._completionShellScriptContent) {
			let startText = util.format(AutoCompletionService.COMPLETION_START_COMMENT_PATTERN, this.$staticConfig.CLIENT_NAME.toLowerCase());
			let content = util.format("if [ -f %s ]; then \n    source %s \nfi", this.cliRunCommandsFile, this.cliRunCommandsFile)
			let endText = util.format(AutoCompletionService.COMPLETION_END_COMMENT_PATTERN, this.$staticConfig.CLIENT_NAME.toLowerCase());
			this._completionShellScriptContent = util.format("\n%s\n%s\n%s\n", startText, content, endText);
		}

		return this._completionShellScriptContent;
	}

	public isAutoCompletionEnabled(): IFuture<boolean> {
		return ((): boolean => {
			let result = true;
			_.each(this.shellProfiles, filePath => {
				result = this.isNewAutoCompletionEnabledInFile(filePath).wait() || this.isObsoleteAutoCompletionEnabledInFile(filePath).wait();
				if(!result) {
					// break each
					return false;
				}
			});

			return result;
		}).future<boolean>()();
	}

	public disableAutoCompletion(): IFuture<void> {
		return (() => {
			_.each(this.shellProfiles, shellFile => this.removeAutoCompletionFromShellScript(shellFile).wait());
			this.removeObsoleteAutoCompletion().wait();

			if(this.scriptsOk && this.scriptsUpdated) {
				this.$logger.out("Restart your shell to disable command auto-completion.");
			}
		}).future<void>()();
	}

	public enableAutoCompletion(): IFuture<void> {
		return (() => {
			this.updateCLIShellScript().wait();
			_.each(this.shellProfiles, shellFile => this.addAutoCompletionToShellScript(shellFile).wait());
			this.removeObsoleteAutoCompletion().wait();

			if(this.scriptsOk && this.scriptsUpdated) {
				this.$logger.out("Restart your shell to enable command auto-completion.");
			}
		}).future<void>()();
	}

	public isObsoleteAutoCompletionEnabled(): IFuture<boolean> {
		return (() => {
			let result = true;
			_.each(this.shellProfiles, shellProfile => {
				result = this.isObsoleteAutoCompletionEnabledInFile(shellProfile).wait();
				if(!result) {
					// break each
					return false;
				}
			});

			return result;
		}).future<boolean>()();
	}

	private isNewAutoCompletionEnabledInFile(fileName: string): IFuture<boolean> {
		return ((): boolean => {
			try {
				let data = this.$fs.readText(fileName).wait();
				if(data && data.indexOf(this.completionShellScriptContent) !== -1) {
					return true;
				}
			} catch(err) {
				this.$logger.trace("Error while checking is autocompletion enabled in file %s. Error is: '%s'", fileName, err.toString());
			}

			return false;
		}).future<boolean>()();
	}

	private isObsoleteAutoCompletionEnabledInFile(fileName: string): IFuture<boolean> {
		return (() => {
			try {
				let text = this.$fs.readText(fileName).wait();
				return text.match(this.getTabTabObsoleteRegex(this.$staticConfig.CLIENT_NAME)) || text.match(this.getTabTabObsoleteRegex(this.$staticConfig.CLIENT_NAME));
			} catch(err) {
				this.$logger.trace("Error while checking is obsolete autocompletion enabled in file %s. Error is: '%s'", fileName, err.toString());
			}
		}).future<boolean>()();
	}

	private addAutoCompletionToShellScript(fileName: string): IFuture<void> {
		return (() => {
			try {
				if(!this.isNewAutoCompletionEnabledInFile(fileName).wait() || this.isObsoleteAutoCompletionEnabledInFile(fileName).wait()) {
					this.$logger.trace("AutoCompletion is not enabled in %s file. Trying to enable it.", fileName);
					this.$fs.appendFile(fileName, this.completionShellScriptContent).wait();
					this.scriptsUpdated = true;
				}
			} catch(err) {
				this.$logger.out("Unable to update %s. Command-line completion might not work.", fileName);
				// When npm is installed with sudo, in some cases the installation cannot write to shell profiles
				// Advise the user how to enable autocompletion after the installation is completed.
				if(err.code === "EPERM" && !this.$hostInfo.isWindows && process.env.SUDO_USER) {
					this.$logger.out("To enable command-line completion, run '$ %s autocomplete enable'.", this.$staticConfig.CLIENT_NAME);
				}

				this.$logger.trace(err);
				this.scriptsOk = false;
			}
		}).future<void>()();
	}

	private removeAutoCompletionFromShellScript(fileName: string): IFuture<void> {
		return (() => {
			try {
				if(this.isNewAutoCompletionEnabledInFile(fileName).wait()) {
					this.$logger.trace("AutoCompletion is enabled in %s file. Trying to disable it.", fileName);
					let data = this.$fs.readText(fileName).wait();
					data = data.replace(this.completionShellScriptContent, "");
					this.$fs.writeFile(fileName, data).wait();
					this.scriptsUpdated = true;
				}
			} catch(err) {
				// If file does not exist, autocompletion was not working for it, so ignore this error.
				if(err.code !== "ENOENT") {
					this.$logger.out("Failed to update %s. Auto-completion may still work or work incorrectly. ", fileName);
					this.$logger.out(err);
					this.scriptsOk = false;
				}
			}
		}).future<void>()();
	}

	private updateCLIShellScript(): IFuture<void> {
		return (() => {
			let filePath = this.cliRunCommandsFile;

			try {
				let doUpdate = true;
				if (this.$fs.exists(filePath).wait()) {
					let contents = this.$fs.readText(filePath).wait();
					let regExp = new RegExp(util.format("%s\\s+completion\\s+--\\s+", this.$staticConfig.CLIENT_NAME.toLowerCase()));
					let matchCondition = contents.match(regExp);
					if(this.$staticConfig.CLIENT_NAME_ALIAS) {
						matchCondition = matchCondition || contents.match(new RegExp(util.format("%s\\s+completion\\s+--\\s+", this.$staticConfig.CLIENT_NAME_ALIAS.toLowerCase())));
					}

					if (matchCondition) {
						doUpdate = false;
					}
				}

				if(doUpdate) {
					let clientExecutableFileName = (this.$staticConfig.CLIENT_NAME_ALIAS || this.$staticConfig.CLIENT_NAME).toLowerCase()
					let pathToExecutableFile = path.join(__dirname, `../../../bin/${clientExecutableFileName}.js`);
					this.$childProcess.exec(`${process.argv[0]} ${pathToExecutableFile} completion >> ${filePath}`).wait();
					this.$fs.chmod(filePath, "0644").wait();
				}
			} catch(err) {
				this.$logger.out("Failed to update %s. Auto-completion may not work. ", filePath);
				this.$logger.trace(err);
				this.scriptsOk = false;
			}
		}).future<void>()();
	}

	private getHomePath(fileName: string): string {
		return path.join(osenv.home(), fileName);
	}
}
$injector.register("autoCompletionService", AutoCompletionService);