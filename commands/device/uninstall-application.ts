///<reference path="../../.d.ts"/>
"use strict";

export class UninstallApplicationCommand implements ICommand {
	constructor(private $devicesServices: Mobile.IDevicesServices,
				private $stringParameter: ICommandParameter,
				private $options: ICommonOptions) { }

	allowedParameters: ICommandParameter[] = [this.$stringParameter];

	public execute(args: string[]): IFuture<void> {
		return (() => {
			this.$devicesServices.initialize({ deviceId: this.$options.device, skipInferPlatform: true }).wait();

			let action = (device: Mobile.IDevice) =>  {
				return (() => device.applicationManager.uninstallApplication(args[0]).wait()).future<void>()();
			};
			this.$devicesServices.execute(action).wait();
		}).future<void>()();
	}
}
$injector.registerCommand("device|uninstall", UninstallApplicationCommand);
