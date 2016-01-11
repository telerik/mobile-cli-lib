///<reference path="../../.d.ts"/>
"use strict";

export class DeviceAppDataFactory implements Mobile.IDeviceAppDataFactory {
	constructor(private $deviceAppDataProvider: Mobile.IDeviceAppDataProvider,
		private $injector: IInjector,
		private $options: ICommonOptions) { }

	create<T>(appIdentifier: string, platform: string, device: Mobile.IDevice): T {
		let factoryRules = this.$deviceAppDataProvider.createFactoryRules();
		let ctor = (<any>factoryRules[platform])[this.$options.companion ? "companion" : "vanilla"];
		return this.$injector.resolve(ctor, { _appIdentifier: appIdentifier, device: device, platform: platform });
	}
}
$injector.register("deviceAppDataFactory", DeviceAppDataFactory);
