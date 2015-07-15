
///<reference path="../../../.d.ts"/>
"use strict";

import helpers = require("./../../helpers");
import Future = require("fibers/future");

export class StopApplicationOnDeviceCommand implements ICommand {

	constructor(private $devicesServices: Mobile.IDevicesServices,
		private $errors: IErrors,
		private $stringParameter: ICommandParameter,
		private $staticConfig: Config.IStaticConfig,
		private $options: IOptions) { }

	allowedParameters: ICommandParameter[] = [this.$stringParameter];

	public execute(args: string[]): IFuture<void> {
		return (() => {
			this.$devicesServices.initialize({ deviceId: this.$options.device, skipInferPlatform: true }).wait();

			if (this.$devicesServices.deviceCount > 1) {
				this.$errors.failWithoutHelp("More than one device found. Specify device explicitly with --device option.To discover device ID, use $%s device command.", this.$staticConfig.CLIENT_NAME.toLowerCase());
			}

			let action = (device: Mobile.IDevice) =>  { return (() => device.applicationManager.stopApplication(args[0]).wait()).future<void>()(); };
			this.$devicesServices.execute(action).wait();
		}).future<void>()();
	}
}
$injector.registerCommand("device|stop", StopApplicationOnDeviceCommand);