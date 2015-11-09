///<reference path="../../.d.ts"/>
"use strict";

import { createTable } from "../../helpers";

export class ListDevicesCommand implements ICommand {
	constructor(private $devicesService: Mobile.IDevicesService,
		private $logger: ILogger,
		private $stringParameter: ICommandParameter,
		private $options: ICommonOptions) { }

	allowedParameters = [this.$stringParameter];

	public execute(args: string[]): IFuture<void> {
		return (() => {
			let index = 1;
			this.$devicesService.initialize({platform: args[0], deviceId: null, skipInferPlatform: true}).wait();

			let table: any = createTable(["#", "Device Name", "Platform", "Device Identifier"], []);
			let action: (_device: Mobile.IDevice) => IFuture<void>;
			if (this.$options.json) {
				this.$logger.setLevel("ERROR");
				action = (device) => {
					return (() => {
						this.$logger.out(JSON.stringify(device.deviceInfo));
					}).future<void>()();
				};
			} else {
				action = (device) => {
					return (() => {
						table.push([(index++).toString(), device.deviceInfo.displayName, device.deviceInfo.platform, device.deviceInfo.identifier]);
					}).future<void>()();
				};
			}

			this.$devicesService.execute(action, undefined, {allowNoDevices: true}).wait();

			if (!this.$options.json && table.length) {
				this.$logger.out(table.toString());
			}
		}).future<void>()();
	}
}
$injector.registerCommand("device|*list", ListDevicesCommand);

class ListAndroidDevicesCommand implements ICommand {
	constructor(private $injector: IInjector,
		private $devicePlatformsConstants: Mobile.IDevicePlatformsConstants) { }

	allowedParameters: ICommandParameter[] = [];

	public execute(args: string[]): IFuture<void> {
		return (() => {
			let listDevicesCommand: ICommand = this.$injector.resolve(ListDevicesCommand);
			let platform = this.$devicePlatformsConstants.Android;
			listDevicesCommand.execute([platform]).wait();
		}).future<void>()();
	}
}
$injector.registerCommand("device|android", ListAndroidDevicesCommand);

class ListiOSDevicesCommand implements ICommand {
	constructor(private $injector: IInjector,
		private $devicePlatformsConstants: Mobile.IDevicePlatformsConstants) { }

	allowedParameters: ICommandParameter[] = [];

	public execute(args: string[]): IFuture<void> {
		return (() => {
			let listDevicesCommand: ICommand = this.$injector.resolve(ListDevicesCommand);
			let platform = this.$devicePlatformsConstants.iOS;
			listDevicesCommand.execute([platform]).wait();
		}).future<void>()();
	}
}
$injector.registerCommand("device|ios", ListiOSDevicesCommand);
