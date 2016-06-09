///<reference path="../../.d.ts"/>
"use strict";

import * as helpers from "../../helpers";

export class DeviceAppDataBase {
	constructor(private _appIdentifier: string) { }

	get appIdentifier(): string {
		return this._appIdentifier;
	}

	protected getDeviceProjectRootPath(projectRoot: string): string {
		return helpers.fromWindowsRelativePathToUnix(projectRoot);
	}
}

export class CompanionDeviceAppDataBase extends DeviceAppDataBase {
	public isLiveSyncSupported(device: Mobile.IDevice): IFuture<boolean> {
		return (() => {
			let applications = device.applicationManager.getInstalledApplications().wait();
			return _.includes(applications, this.appIdentifier);
		}).future<boolean>()();
	}
}
