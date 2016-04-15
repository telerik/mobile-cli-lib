///<reference path="../.d.ts"/>
"use strict";

import {EOL} from "os";
import future = require("fibers/future");

export class DoctorCommand implements ICommand {

	constructor(private $doctorService: IDoctorService,
		private $logger: ILogger,
		private $staticConfig: Config.IStaticConfig) { }

	public canExecute(args: string[]): IFuture<boolean> {
		return future.fromResult(true);
	}

	public allowedParameters: ICommandParameter[] = [];

	public execute(args: string[]): IFuture<void> {
		return (() => {
			let warningsPrinted = this.$doctorService.printWarnings().wait();
			if (warningsPrinted) {
				let client = this.$staticConfig.CLIENT_NAME_ALIAS || this.$staticConfig.CLIENT_NAME;
				this.$logger.out(`These warnings are just used to help the ${client} maintainers with debugging if you file an issue.`.bold
					+ EOL + `Please ignore them if everything you use ${client} for is working fine.`.bold + EOL);
			} else {
				this.$logger.out("No issues were detected.".bold);
			}
		}).future<void>()();
	}
}

$injector.registerCommand("doctor", DoctorCommand);
