///<reference path="../../.d.ts"/>
"use strict";

import helpers = require("./../../helpers");

export class OpenDeviceLogStreamCommand implements ICommand {
	private static NOT_SPECIFIED_DEVICE_ERROR_MESSAGE = "More than one device found. Specify device explicitly.";

	constructor(private $devicesServices: Mobile.IDevicesServices,
		private $errors: IErrors,
		private $commandsService: ICommandsService,
		private $options: ICommonOptions) { }

	allowedParameters: ICommandParameter[] = [];

	public execute(args: string[]): IFuture<void> {
		return (() => {
			this.$devicesServices.initialize({ deviceId: this.$options.device, skipInferPlatform: true }).wait();

			if (this.$devicesServices.deviceCount > 1) {
				this.$commandsService.tryExecuteCommand("device", []).wait();
				this.$errors.fail(OpenDeviceLogStreamCommand.NOT_SPECIFIED_DEVICE_ERROR_MESSAGE);
			}

			let action = (device: Mobile.IDevice) =>  { return (() => device.openDeviceLogStream()).future<void>()(); };
			this.$devicesServices.execute(action).wait();
		}).future<void>()();
	}
}
$injector.registerCommand("device|log", OpenDeviceLogStreamCommand);