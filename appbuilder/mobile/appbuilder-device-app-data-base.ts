import * as querystring from "querystring";
import { DeviceAppDataBase } from "./../../mobile/device-app-data/device-app-data-base";

export class AppBuilderDeviceAppDataBase extends DeviceAppDataBase implements ILiveSyncDeviceAppData {
	constructor(_appIdentifier: string,
		public device: Mobile.IDevice,
		public platform: string,
		private $deployHelper: IDeployHelper,
		private $devicePlatformsConstants: Mobile.IDevicePlatformsConstants) {
		super(_appIdentifier);
	}

	public getDeviceProjectRootPath(): Promise<string> {
		return Promise.resolve();
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

	public async isLiveSyncSupported(): Promise<boolean> {
		let isApplicationInstalled = await this.device.applicationManager.isApplicationInstalled(this.appIdentifier);

		if (!isApplicationInstalled) {
			await this.$deployHelper.deploy(this.platform.toString());
			// Update cache of installed apps
			await this.device.applicationManager.checkForApplicationUpdates();
		}

		return await this.device.applicationManager.isLiveSyncSupported(this.appIdentifier);
	}
}
