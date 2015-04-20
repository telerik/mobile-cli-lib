///<reference path="../../.d.ts"/>
"use strict";
import osenv = require("osenv");
import path = require("path");
import util = require("util");
import hostInfo = require("../host-info");

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
		private $staticConfig: Config.IStaticConfig) { }

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
			if(hostInfo.isWindows()) {
				// on Windows bash, file is incorrectly written as C:\Users\<username>, which leads to errors when trying to execute the script:
				// $ source ~/.bashrc
				// sh.exe": C:Usersusername.appbuilderrc: No such file or directory
				this._cliRunCommandsFile = this._cliRunCommandsFile.replace(/\\/g, "/");
			}
		}

		return this._cliRunCommandsFile;
	}

	private getTabTabObsoleteRegex(clientName: string): RegExp {
		var tabTabStartPoint = util.format(AutoCompletionService.TABTAB_COMPLETION_START_REGEX_PATTERN, clientName.toLowerCase());
		var tabTabEndPoint = util.format(AutoCompletionService.TABTAB_COMPLETION_END_REGEX_PATTERN, clientName.toLowerCase());
		var tabTabRegex = new RegExp(util.format("%s[\\s\\S]*%s", tabTabStartPoint, tabTabEndPoint));
		return tabTabRegex;
	}

	public removeObsoleteAutoCompletion(): IFuture<void> {
		return (() => {
			// In previous releases we were writing directly in .bash_profile, .bashrc, .zshrc and .profile - remove this old code
			var shellProfilesToBeCleared = this.shellProfiles;
			// Add .profile only here as we do not want new autocompletion in this file, but we have to remove our old code from it.
			shellProfilesToBeCleared.push(this.getHomePath(".profile"));
			shellProfilesToBeCleared.forEach(file => {
				try {
					var text = this.$fs.readText(file).wait();
					var newText = text.replace(this.getTabTabObsoleteRegex(this.$staticConfig.CLIENT_NAME), "");
					if(this.$staticConfig.CLIENT_NAME_ALIAS) {
						newText = newText.replace(this.getTabTabObsoleteRegex(this.$staticConfig.CLIENT_NAME_ALIAS), "");
					}

					if(newText !== text) {
						this.$logger.trace("Remove obsolete AutoCompletion from file %s.", file);
						this.$fs.writeFile(file, newText).wait();
					}
				} catch(error) {
					if(error.code !== "ENOENT") {
						this.$logger.trace("Error while trying to disable autocompletion for '%s' file. Error is:\n%s", error);
					}
				}
			});
		}).future<void>()();
	}

	private get completionShellScriptContent() {
		if(!this._completionShellScriptContent) {
			var startText = util.format(AutoCompletionService.COMPLETION_START_COMMENT_PATTERN, this.$staticConfig.CLIENT_NAME.toLowerCase());
			var content = util.format("if [ -f %s ]; then \n    source %s \nfi", this.cliRunCommandsFile, this.cliRunCommandsFile)
			var endText = util.format(AutoCompletionService.COMPLETION_END_COMMENT_PATTERN, this.$staticConfig.CLIENT_NAME.toLowerCase());
			this._completionShellScriptContent = util.format("\n%s\n%s\n%s\n", startText, content, endText);
		}

		return this._completionShellScriptContent;
	}

	public isAutoCompletionEnabled(): IFuture<boolean> {
		return ((): boolean => {
			var result = true;
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
			var result = true;
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
			var data = this.$fs.readText(fileName).wait();
			if(data && data.indexOf(this.completionShellScriptContent) !== -1) {
				return true;
			}

			return false;
		}).future<boolean>()();
	}

	private isObsoleteAutoCompletionEnabledInFile(fileName: string): IFuture<boolean> {
		return (() => {
			var text = this.$fs.readText(fileName).wait();
			return text.match(this.getTabTabObsoleteRegex(this.$staticConfig.CLIENT_NAME)) || text.match(this.getTabTabObsoleteRegex(this.$staticConfig.CLIENT_NAME));
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
			} catch (err) {
				this.$logger.out("Failed to update %s. Auto-completion may not work. ", fileName);
				this.$logger.out(err);
				this.scriptsOk = false;
			}
		}).future<void>()();
	}

	private removeAutoCompletionFromShellScript(fileName: string): IFuture<void> {
		return (() => {
			try {
				if(this.isNewAutoCompletionEnabledInFile(fileName).wait()) {
					this.$logger.trace("AutoCompletion is enabled in %s file. Trying to disable it.", fileName);
					var data = this.$fs.readText(fileName).wait();
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
			try {
				var filePath = this.cliRunCommandsFile;

				var doUpdate = true;
				if (this.$fs.exists(filePath).wait()) {
					var contents = this.$fs.readText(filePath).wait();
					var regExp = new RegExp(util.format("%s\\s+completion\\s+--\\s+", this.$staticConfig.CLIENT_NAME.toLowerCase()));
					var matchCondition = contents.match(regExp);
					if(this.$staticConfig.CLIENT_NAME_ALIAS) {
						matchCondition = matchCondition || contents.match(new RegExp(util.format("%s\\s+completion\\s+--\\s+", this.$staticConfig.CLIENT_NAME_ALIAS.toLowerCase())));
					}

					if (matchCondition) {
						doUpdate = false;
					}
				}

				if(doUpdate) {
					this.$childProcess.exec(this.$staticConfig.CLIENT_NAME.toLowerCase() + " completion >> " + filePath).wait();
					this.$fs.chmod(filePath, "0777").wait();
				}
			} catch(err) {
				this.$logger.out("Failed to update %s. Auto-completion may not work. ", filePath);
				this.$logger.out(err);
				this.scriptsOk = false;
			}
		}).future<void>()();
	}

	private getHomePath(fileName: string): string {
		return path.join(osenv.home(), fileName);
	}
}
$injector.register("autoCompletionService", AutoCompletionService);