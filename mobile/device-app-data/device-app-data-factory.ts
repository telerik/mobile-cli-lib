///<reference path="../../.d.ts"/>
"use strict";

export class DeviceAppDataFactory implements Mobile.IDeviceAppDataFactory {
	constructor(private $deviceAppDataProvider: Mobile.IDeviceAppDataProvider,
		private $options: ICommonOptions) { }
			
	create<T>(appIdentifier: string, platform: string): T {
		let factoryRules = this.$deviceAppDataProvider.createFactoryRules();
		let ctor = (<any>factoryRules[platform])[this.$options.companion ? "companion" : "vanilla"];
		return new ctor(appIdentifier);
	}
}
$injector.register("deviceAppDataFactory", DeviceAppDataFactory);