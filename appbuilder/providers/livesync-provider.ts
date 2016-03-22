///<reference path="../../.d.ts"/>
"use strict";

import { AppBuilderLiveSyncProviderBase } from "./appbuilder-livesync-provider-base";

export class LiveSyncProvider extends AppBuilderLiveSyncProviderBase {
	constructor($androidLiveSyncServiceLocator: {factory: Function},
		$iosLiveSyncServiceLocator: {factory: Function}) {
			super($androidLiveSyncServiceLocator, $iosLiveSyncServiceLocator);
		}

	public buildForDevice(device: Mobile.IDevice): IFuture<string> {
		return (() => {
			throw new Error(`Application is not installed on device ${device.deviceInfo.identifier}. Cannot LiveSync changes without installing the application before that.`);
		}).future<string>()();
	}
}
$injector.register("liveSyncProvider", LiveSyncProvider);
