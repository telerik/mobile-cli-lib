///<reference path="../../../.d.ts"/>
"use strict";

import path = require("path");
import helpers = require("../../helpers");
import constants = require("../constants");

export class DeviceAppDataBase {
	constructor(private _appIdentifier: string) { }

	get appIdentifier(): string {
		return this._appIdentifier;
	}

	protected getDeviceProjectRootPath(projectRoot: string): string {
		return helpers.fromWindowsRelativePathToUnix(projectRoot);
	}
}

export class AndroidDeviceAppDataBase extends DeviceAppDataBase {
	public isLiveSyncSupported(device: Mobile.IAndroidDevice): IFuture<boolean> {
		return (() => {
			let broadcastResult = device.adb.sendBroadcastToDevice(constants.CHECK_LIVESYNC_INTENT_NAME, {"app-id": this.appIdentifier}).wait();
			return broadcastResult !== 0;
		}).future<boolean>()();
	}
}

export class CompanionDeviceAppDataBase extends DeviceAppDataBase {
	public isLiveSyncSupported(device: Mobile.IDevice): IFuture<boolean> {
		return (() => {
			let applications = device.applicationManager.getInstalledApplications().wait();
			return _.contains(applications, this.appIdentifier);
		}).future<boolean>()();
	}
}