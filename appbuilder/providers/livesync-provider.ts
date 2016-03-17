///<reference path="../../.d.ts"/>
"use strict";

import Future = require("fibers/future");
import { AppBuilderLiveSyncProviderBase } from "./appbuilder-livesync-provider-base";

export class LiveSyncProvider extends AppBuilderLiveSyncProviderBase {
	constructor($androidLiveSyncServiceLocator: {factory: Function},
		$iosLiveSyncServiceLocator: {factory: Function}) {
			super($androidLiveSyncServiceLocator, $iosLiveSyncServiceLocator);
		}

	public buildForDevice(device: Mobile.IDevice): IFuture<string> {
		return Future.fromResult(null);
	}
}
$injector.register("liveSyncProvider", LiveSyncProvider);
