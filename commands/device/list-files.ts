///<reference path="../../.d.ts"/>
"use strict";

export class ListFilesCommand implements ICommand {
	constructor(private $devicesService: Mobile.IDevicesService,
				private $stringParameter: ICommandParameter,
				private $options: ICommonOptions) { }

	allowedParameters: ICommandParameter[] = [this.$stringParameter];

	public execute(args: string[]): IFuture<void> {
		return (() => {
			this.$devicesService.initialize({ deviceId: this.$options.device, skipInferPlatform: true }).wait();

			let action = (device: Mobile.IDevice) =>  { return (() => device.fileSystem.listFiles(args[0]).wait()).future<void>()(); };
			this.$devicesService.execute(action).wait();
		}).future<void>()();
	}
}
$injector.registerCommand("device|list-files", ListFilesCommand);
