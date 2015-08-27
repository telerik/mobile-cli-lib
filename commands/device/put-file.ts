///<reference path="../../.d.ts"/>
"use strict";

export class PutFileCommand implements ICommand {
	constructor(private $devicesService: Mobile.IDevicesService,
				private $stringParameter: ICommandParameter,
				private $options: ICommonOptions) { }

	allowedParameters: ICommandParameter[] = [this.$stringParameter, this.$stringParameter];

	public execute(args: string[]): IFuture<void> {
		return (() => {
			this.$devicesService.initialize({ deviceId: this.$options.device, skipInferPlatform: true }).wait();

			let action = (device: Mobile.IDevice) =>  { return (() => device.fileSystem.putFile(args[0], args[1]).wait()).future<void>()(); };
			this.$devicesService.execute(action).wait();
		}).future<void>()();
	}
}
$injector.registerCommand("device|put-file", PutFileCommand);
