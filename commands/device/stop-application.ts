///<reference path="../../.d.ts"/>
"use strict";

import helpers = require("./../../helpers");
import Future = require("fibers/future");

export class StopApplicationOnDeviceCommand implements ICommand {

	constructor(private $devicesServices: Mobile.IDevicesServices,
		private $errors: IErrors,
		private $stringParameter: ICommandParameter,
		private $staticConfig: Config.IStaticConfig,
		private $options: ICommonOptions) { }

	allowedParameters: ICommandParameter[] = [this.$stringParameter, this.$stringParameter];

	public execute(args: string[]): IFuture<void> {
		return (() => {
			this.$devicesServices.initialize({ deviceId: this.$options.device, skipInferPlatform: true, platform: args[1] }).wait();
			
			let action = (device: Mobile.IDevice) => device.applicationManager.stopApplication(args[0]);
			this.$devicesServices.execute(action).wait();
		}).future<void>()();
	}
}
$injector.registerCommand("device|stop", StopApplicationOnDeviceCommand);