///<reference path="../../../.d.ts"/>
"use strict";

import options = require("./../../options");

export class ListApplicationsCommand implements ICommand {
	constructor(private $devicesServices: Mobile.IDevicesServices) { }

	allowedParameters: ICommandParameter[] = [];

	public execute(args: string[]): IFuture<void> {
		return (() => {
			this.$devicesServices.initialize(undefined, options.device, {skipInferPlatform: true}).wait();

			var action = (device: Mobile.IDevice) =>  { return (() => device.listApplications()).future<void>()(); };
			this.$devicesServices.execute(action).wait();
		}).future<void>()();
	}
}
$injector.registerCommand("device|list-applications", ListApplicationsCommand);