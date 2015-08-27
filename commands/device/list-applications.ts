///<reference path="../../.d.ts"/>
"use strict";

import {EOL} from "os";
import * as util from "util";

export class ListApplicationsCommand implements ICommand {
	constructor(private $devicesService: Mobile.IDevicesService,
		private $logger: ILogger,
		private $options: ICommonOptions) { }

	allowedParameters: ICommandParameter[] = [];

	public execute(args: string[]): IFuture<void> {
		return (() => {

			this.$devicesService.initialize({ deviceId: this.$options.device, skipInferPlatform: true }).wait();
			let output: string[] = [];

			let action = (device: Mobile.IDevice) => { return (() => {
				let applications = device.applicationManager.getInstalledApplications().wait();
				output.push(util.format("%s=====Installed applications on device with UDID '%s' are:", EOL, device.deviceInfo.identifier));
				_.each(applications, (applicationId: string) => output.push(applicationId));
			}).future<void>()(); };
			this.$devicesService.execute(action).wait();

			this.$logger.out(output.join(EOL));
		}).future<void>()();
	}
}
$injector.registerCommand("device|list-applications", ListApplicationsCommand);
