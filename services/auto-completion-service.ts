///<reference path="../../.d.ts"/>
"use strict";
import osenv = require("osenv");
import path = require("path");
import util = require("util");

export class AutoCompletionService implements IAutoCompletionService {
	private scriptsOk = true;

	constructor(private $fs: IFileSystem,
		private $childProcess: IChildProcess,
		private $logger: ILogger,
		private $staticConfig: Config.IStaticConfig) {	}

	public disableAnalytics = true;

	public enableAutoCompletion(): IFuture<void> {
		return (() => {
			this.updateShellScript(".bashrc").wait();
			this.updateShellScript(".bash_profile").wait();
			this.updateShellScript(".zshrc").wait(); // zsh - http://www.acm.uiuc.edu/workshops/zsh/startup_files.html

			if(this.scriptsOk) {
				this.$logger.out("Restart your shell to enable command auto-completion.");
			}
		}).future<void>()();
	}

	private updateShellScript(fileName: string): IFuture<void> {
		return (() => {
			try {
				this.updateShellScriptCore(fileName).wait();
			} catch (err) {
				this.$logger.out("Failed to update %s. Auto-completion may not work. ", fileName);
				this.$logger.out(err);
				this.scriptsOk = false;
			}
		}).future<void>()();
	}

	private updateShellScriptCore(fileName: string): IFuture<void> {
		return (() => {
			var filePath = this.getHomePath(fileName);

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
			}

		}).future<void>()();
	}

	private getHomePath(fileName: string): string {
		return path.join(osenv.home(), fileName);
	}
}
$injector.register("autoCompletionService", AutoCompletionService);