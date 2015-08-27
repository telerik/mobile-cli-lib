///<reference path="../../.d.ts"/>
"use strict";

export class OpenDeviceLogStreamCommand implements ICommand {
	private static NOT_SPECIFIED_DEVICE_ERROR_MESSAGE = "More than one device found. Specify device explicitly.";

	constructor(private $devicesService: Mobile.IDevicesService,
		private $errors: IErrors,
		private $commandsService: ICommandsService,
		private $options: ICommonOptions) { }

	allowedParameters: ICommandParameter[] = [];

	public execute(args: string[]): IFuture<void> {
		return (() => {
			this.$devicesService.initialize({ deviceId: this.$options.device, skipInferPlatform: true }).wait();

			if (this.$devicesService.deviceCount > 1) {
				this.$commandsService.tryExecuteCommand("device", []).wait();
				this.$errors.fail(OpenDeviceLogStreamCommand.NOT_SPECIFIED_DEVICE_ERROR_MESSAGE);
			}

			let action = (device: Mobile.IDevice) =>  { return (() => device.openDeviceLogStream()).future<void>()(); };
			this.$devicesService.execute(action).wait();
		}).future<void>()();
	}
}
$injector.registerCommand("device|log", OpenDeviceLogStreamCommand);
