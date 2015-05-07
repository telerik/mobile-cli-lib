///<reference path="../../../.d.ts"/>
"use strict";
import options = require("./../../options");

export class PutFileCommand implements ICommand {
	constructor(private $devicesServices: Mobile.IDevicesServices,
				private $stringParameter: ICommandParameter) { }

	allowedParameters: ICommandParameter[] = [this.$stringParameter, this.$stringParameter];

	public execute(args: string[]): IFuture<void> {
		return (() => {
			this.$devicesServices.initialize({ deviceId: options.device, skipInferPlatform: true }).wait();

			let action = (device: Mobile.IDevice) =>  { return (() => device.putFile(args[0], args[1]).wait()).future<void>()(); };
			this.$devicesServices.execute(action).wait();
		}).future<void>()();
	}
}
$injector.registerCommand("device|put-file", PutFileCommand);
