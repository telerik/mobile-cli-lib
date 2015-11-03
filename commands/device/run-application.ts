///<reference path="../../.d.ts"/>
"use strict";

export class RunApplicationOnDeviceCommand implements ICommand {

	constructor(private $devicesService: Mobile.IDevicesService,
		private $errors: IErrors,
		private $stringParameter: ICommandParameter,
		private $staticConfig: Config.IStaticConfig,
		private $options: ICommonOptions) { }

	allowedParameters: ICommandParameter[] = [this.$stringParameter];

	public execute(args: string[]): IFuture<void> {
		return (() => {
			this.$devicesService.initialize({ deviceId: this.$options.device, skipInferPlatform: true }).wait();

			if (this.$devicesService.deviceCount > 1) {
				this.$errors.failWithoutHelp("More than one device found. Specify device explicitly with --device option. To discover device ID, use $%s device command.", this.$staticConfig.CLIENT_NAME.toLowerCase());
			}

			let action = (device: Mobile.IDevice) => device.applicationManager.startApplication(args[0]);
			this.$devicesService.execute(action).wait();
		}).future<void>()();
	}
}
$injector.registerCommand("device|run", RunApplicationOnDeviceCommand);
