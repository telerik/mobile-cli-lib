///<reference path="../../.d.ts"/>
"use strict";

import * as helpers from "../../helpers";
import * as querystring from "querystring";

export class DeviceAppDataBase implements ILiveSyncDeviceAppData {
	public deviceProjectRootPath: string;

	constructor(private _appIdentifier: string,
		public device: Mobile.IDevice,
		public platform: string,
		private $deployHelper: IDeployHelper,
		private $devicePlatformsConstants: Mobile.IDevicePlatformsConstants) { }

	public get appIdentifier(): string {
		return this._appIdentifier;
	}

	public get liveSyncFormat(): string {
		return null;
	}

	public encodeLiveSyncHostUri(hostUri: string): string {
		return querystring.escape(hostUri);
	}

	public getLiveSyncNotSupportedError(): string {
		return `You can't LiveSync on device with id ${this.device.deviceInfo.identifier}! Deploy the app with LiveSync enabled and wait for the initial start up before LiveSyncing.`;
	}

	public isLiveSyncSupported(): IFuture<boolean> {
		return (() => {
			let isApplicationInstalled = this.device.applicationManager.isApplicationInstalled(this.appIdentifier).wait();
			if (!isApplicationInstalled) {
				this.$deployHelper.deploy(this.platform.toString()).wait();
				// Update cache of installed apps
				this.device.applicationManager.checkForApplicationUpdates().wait();
			}
			return this.device.applicationManager.isLiveSyncSupported(this.appIdentifier).wait();
		}).future<boolean>()();
	}

	protected getDeviceProjectRootPath(projectRoot: string): string {
		return helpers.fromWindowsRelativePathToUnix(projectRoot);
	}
}

export abstract class CompanionDeviceAppDataBase extends DeviceAppDataBase {
	public isLiveSyncSupported(): IFuture<boolean> {
		return this.device.applicationManager.isApplicationInstalled(this.appIdentifier);
	}

	public getLiveSyncNotSupportedError(): string {
		return `Cannot LiveSync changes to the ${this.getCompanionAppName()}. The ${this.getCompanionAppName()} is not installed on ${this.device.deviceInfo.identifier}.`;
	}

	protected abstract getCompanionAppName(): string;
}
