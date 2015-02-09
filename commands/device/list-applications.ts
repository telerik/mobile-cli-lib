///<reference path="../../../.d.ts"/>
"use strict";

import options = require("./../../options");
import os = require("os");
import util = require("util");

export class ListApplicationsCommand implements ICommand {
	constructor(private $devicesServices: Mobile.IDevicesServices,
		private $logger: ILogger) { }

	allowedParameters: ICommandParameter[] = [];

	public execute(args: string[]): IFuture<void> {
		return (() => {
			this.$devicesServices.initialize({ deviceId: options.device, skipInferPlatform: true }).wait();
			var output: string[] = [];

			var action = (device: Mobile.IDevice) =>  { return (() => {
				var applications = device.getInstalledApplications().wait();
				output.push(util.format("%s=====Installed applications on device with UDID '%s' are:", os.EOL, device.getIdentifier()));
				_.each(applications, (applicationId: string) => output.push(applicationId));
			}).future<void>()(); };
			this.$devicesServices.execute(action).wait();

			this.$logger.out(output.join(os.EOL));
		}).future<void>()();
	}
}
$injector.registerCommand("device|list-applications", ListApplicationsCommand);