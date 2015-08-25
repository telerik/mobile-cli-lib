///<reference path="../../.d.ts"/>
"use strict";

import os = require("os");
import util = require("util");

export class ListApplicationsCommand implements ICommand {
	constructor(private $devicesServices: Mobile.IDevicesServices,
		private $logger: ILogger,
		private $options: ICommonOptions) { }

	allowedParameters: ICommandParameter[] = [];

	public execute(args: string[]): IFuture<void> {
		return (() => {

			this.$devicesServices.initialize({ deviceId: this.$options.device, skipInferPlatform: true }).wait();
			let output: string[] = [];

			let action = (device: Mobile.IDevice) => { return (() => {
				let applications = device.applicationManager.getInstalledApplications().wait();
				output.push(util.format("%s=====Installed applications on device with UDID '%s' are:", os.EOL, device.deviceInfo.identifier));
				_.each(applications, (applicationId: string) => output.push(applicationId));
			}).future<void>()(); };
			this.$devicesServices.execute(action).wait();

			this.$logger.out(output.join(os.EOL));
		}).future<void>()();
	}
}
$injector.registerCommand("device|list-applications", ListApplicationsCommand);
