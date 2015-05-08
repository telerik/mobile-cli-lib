///<reference path="../../../.d.ts"/>
"use strict";

import util = require("util");
import options = require("./../../options");
import commandParams = require("../../command-params");

export class ListDevicesCommand implements ICommand {
	constructor(private $devicesServices: Mobile.IDevicesServices,
		private $logger: ILogger,
		private $stringParameter: ICommandParameter) { }

	allowedParameters = [this.$stringParameter];

	public execute(args: string[]): IFuture<void> {
		return (() => {
			let index = 1;
			this.$devicesServices.initialize({platform: args[0], deviceId: null, skipInferPlatform: true}).wait();

			let action: (device: Mobile.IDevice) => IFuture<void>;
			if (options.json) {
				this.$logger.setLevel("ERROR");
				action = (device) => {
					return (() => { this.$logger.out(JSON.stringify({
						identifier: device.getIdentifier(),
						platform: device.getPlatform(),
						model: device.getModel(),
						name: device.getDisplayName(),
						version: device.getVersion(),
						vendor: device.getVendor()
					}))}).future<void>()();
				};
			} else {
				action = (device) => {
					return (() => { this.$logger.out("%s: '%s'", (index++).toString(), device.getDisplayName(), device.getPlatform(), device.getIdentifier()); }).future<void>()();
				};
			}

			this.$devicesServices.execute(action, undefined, {allowNoDevices: true}).wait();
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
