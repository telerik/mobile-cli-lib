///<reference path="../../.d.ts"/>
"use strict";
import osenv = require("osenv");
import path = require("path");
import util = require("util");

export class AutoCompletionService implements IAutoCompletionService {
	constructor(private $fs: IFileSystem,
		private $childProcess: IChildProcess,
		private $logger: ILogger,
		private $staticConfig: IStaticConfig) {	}

	public disableAnalytics = true;

	public enableAutoCompletion(): IFuture<void> {
		return (() => {
			var scriptsOk = true;

			try {
				this.updateShellScript(".bashrc").wait();
				this.updateShellScript(".bash_profile").wait();
				this.updateShellScript(".zshrc").wait(); // zsh - http://www.acm.uiuc.edu/workshops/zsh/startup_files.html
			} catch(err) {
				this.$logger.out("Failed to update all shell start-up scripts. Auto-completion may not work. " + err);
				scriptsOk = false;
			}

			if(scriptsOk) {
				this.$logger.out("Restart your shell to enable command auto-completion.");
			}
		}).future<void>()();
	}

	private updateShellScript(fileName: string): IFuture<void> {
		return (() => {
			var filePath = this.getHomePath(fileName);

			var doUpdate = true;
			if (this.$fs.exists(filePath).wait()) {
				var contents = this.$fs.readText(filePath).wait();
				var regExp = new RegExp(util.format("%s\\s+completion\\s+--\\s+", this.$staticConfig.CLIENT_NAME));
				var matchCondition = contents.match(regExp);
				if(this.$staticConfig.CLIENT_NAME_ALIAS) {
					matchCondition = matchCondition || contents.match(new RegExp(util.format("%s\\s+completion\\s+--\\s+", this.$staticConfig.CLIENT_NAME_ALIAS.toLowerCase())));
				}

				if (matchCondition) {
					doUpdate = false;
				}
			}

			if(doUpdate) {
				this.updateShellScriptCore(filePath).wait();
			}

		}).future<void>()();
	}

	private updateShellScriptCore(filePath: string): IFuture<void> {
		return this.$childProcess.exec(this.$staticConfig.CLIENT_NAME.toLowerCase() + " completion >> " + filePath);
	}

	private getHomePath(fileName: string): string {
		return path.join(osenv.home(), fileName);
	}
}
$injector.register("autoCompletionService", AutoCompletionService);