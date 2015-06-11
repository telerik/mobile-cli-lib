///<reference path="../../.d.ts"/>
"use strict";

import os = require("os");
import future = require("fibers/future");

export class DoctorCommand implements ICommand {

	constructor(private $doctorService: IDoctorService,
		private $logger: ILogger,
		private $staticConfig: IStaticConfig) { }

	public canExecute(args: string[]): IFuture<boolean> {
		return future.fromResult(true);
	}

	public allowedParameters: ICommandParameter[] = [];

	public execute(args: string[]): IFuture<void> {
		return (() => {
			let warningsPrinted = this.$doctorService.printWarnings();
			if (warningsPrinted) {
				this.$logger.out(`These warnings are just used to help the ${this.$staticConfig.CLIENT_NAME_ALIAS || this.$staticConfig.CLIENT_NAME} maintainers with debugging if you file an issue.`.bold + os.EOL +
					`Please ignore them if everything you use ${this.$staticConfig.CLIENT_NAME_ALIAS || this.$staticConfig.CLIENT_NAME} for is working fine.`.bold + os.EOL);
			} else {
				this.$logger.out("No issues were detected.".bold);
			}
		}).future<void>()();
	}
}

$injector.registerCommand("doctor", DoctorCommand);
