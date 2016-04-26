///<reference path="../../.d.ts"/>
"use strict";

export class DeviceAppDataFactory implements Mobile.IDeviceAppDataFactory {
	constructor(private $deviceAppDataProvider: Mobile.IDeviceAppDataProvider,
		private $injector: IInjector,
		private $options: ICommonOptions) { }

	create<T>(appIdentifier: string, platform: string, device: Mobile.IDevice, liveSyncOptions?: { isForCompanionApp: boolean }): T {
		let factoryRules = this.$deviceAppDataProvider.createFactoryRules();
		let isForCompanionApp = (liveSyncOptions && liveSyncOptions.isForCompanionApp) || this.$options.companion;
		let ctor = (<any>factoryRules[platform])[isForCompanionApp ? "companion" : "vanilla"];
		return this.$injector.resolve(ctor, { _appIdentifier: appIdentifier, device: device, platform: platform });
	}
}
$injector.register("deviceAppDataFactory", DeviceAppDataFactory);
