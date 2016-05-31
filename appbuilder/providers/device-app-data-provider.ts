import * as path from "path";
import * as util from "util";
import { AppBuilderDeviceAppDataBase } from "../mobile/appbuilder-device-app-data-base";
import { AppBuilderCompanionDeviceAppDataBase } from "../mobile/appbuilder-companion-device-app-data-base";
import { LiveSyncConstants, TARGET_FRAMEWORK_IDENTIFIERS } from "../../constants";
import Future = require("fibers/future");

export class AndroidAppIdentifier extends AppBuilderDeviceAppDataBase implements ILiveSyncDeviceAppData {
	private _deviceProjectRootPath: string = null;
	private _liveSyncVersion: number;

	constructor(_appIdentifier: string,
		device: Mobile.IDevice,
		platform: string,
		$deployHelper: IDeployHelper,
		$devicePlatformsConstants: Mobile.IDevicePlatformsConstants,
		private $errors: IErrors) {
		super(_appIdentifier, device, platform, $deployHelper, $devicePlatformsConstants);
	}

	public get deviceProjectRootPath(): string {
		if (!this._deviceProjectRootPath) {
			let deviceTmpDirFormat = "";

			let version = this.getLiveSyncVersion().wait();
			if (version === 2) {
				deviceTmpDirFormat = LiveSyncConstants.DEVICE_TMP_DIR_FORMAT_V2;
			} else if (version === 3) {
				deviceTmpDirFormat = LiveSyncConstants.DEVICE_TMP_DIR_FORMAT_V3;
			} else {
				this.$errors.failWithoutHelp(`Unsupported LiveSync version: ${version}`);
			}

			this._deviceProjectRootPath = this.getDeviceProjectRootPath(util.format(deviceTmpDirFormat, this.appIdentifier));
		}

		return this._deviceProjectRootPath;
	}

	public encodeLiveSyncHostUri(hostUri: string): string {
		return hostUri;
	}

	public isLiveSyncSupported(): IFuture<boolean> {
		return (() => {
			return super.isLiveSyncSupported().wait() && this.getLiveSyncVersion().wait() !== 0;
		}).future<boolean>()();
	}

	private getLiveSyncVersion(): IFuture<number> {
		return (() => {
			if (!this._liveSyncVersion) {
				this._liveSyncVersion = (<Mobile.IAndroidDevice>this.device).adb.sendBroadcastToDevice(LiveSyncConstants.CHECK_LIVESYNC_INTENT_NAME, { "app-id": this.appIdentifier }).wait();
			}

			return this._liveSyncVersion;
		}).future<number>()();
	}
}

export class AndroidCompanionAppIdentifier extends AppBuilderCompanionDeviceAppDataBase implements ILiveSyncDeviceAppData {
	constructor(device: Mobile.IDevice,
		platform: string,
		$deployHelper: IDeployHelper,
		$devicePlatformsConstants: Mobile.IDevicePlatformsConstants,
		private $companionAppsService: ICompanionAppsService) {
		super($companionAppsService.getCompanionAppIdentifier(TARGET_FRAMEWORK_IDENTIFIERS.Cordova, platform), device, platform, $deployHelper, $devicePlatformsConstants);
	}

	public get deviceProjectRootPath(): string {
		return this.getDeviceProjectRootPath(util.format(LiveSyncConstants.DEVICE_TMP_DIR_FORMAT_V3, this.appIdentifier));
	}

	public get liveSyncFormat(): string {
		return "icenium://%s?token=%s&appId=%s&configuration=%s";
	}

	protected getCompanionAppName(): string {
		return "companion app";
	}
}

export class AndroidNativeScriptCompanionAppIdentifier extends AppBuilderCompanionDeviceAppDataBase implements ILiveSyncDeviceAppData {
	constructor(device: Mobile.IDevice,
		platform: string,
		$deployHelper: IDeployHelper,
		$devicePlatformsConstants: Mobile.IDevicePlatformsConstants,
		private $companionAppsService: ICompanionAppsService) {
		super($companionAppsService.getCompanionAppIdentifier(TARGET_FRAMEWORK_IDENTIFIERS.Cordova, platform), device, platform, $deployHelper, $devicePlatformsConstants);
	}

	public get deviceProjectRootPath(): string {
		return util.format(LiveSyncConstants.DEVICE_TMP_DIR_FORMAT_V3, this.appIdentifier);
	}

	public get liveSyncFormat(): string {
		return "nativescript://%s?token=%s&appId=%s&configuration=%s";
	}

	protected getCompanionAppName(): string {
		return "NativeScript companion app";
	}
}

export class IOSAppIdentifier extends AppBuilderDeviceAppDataBase implements ILiveSyncDeviceAppData {
	private _deviceProjectRootPath: string = null;

	constructor(_appIdentifier: string,
		device: Mobile.IDevice,
		platform: string,
		$deployHelper: IDeployHelper,
		$devicePlatformsConstants: Mobile.IDevicePlatformsConstants,
		private $iOSSimResolver: Mobile.IiOSSimResolver) {
		super(_appIdentifier, device, platform, $deployHelper, $devicePlatformsConstants);
	}

	public get deviceProjectRootPath(): string {
		if (!this._deviceProjectRootPath) {
			if (this.device.isEmulator) {
				let applicationPath = this.$iOSSimResolver.iOSSim.getApplicationPath(this.device.deviceInfo.identifier, this.appIdentifier);
				this._deviceProjectRootPath = path.join(applicationPath, "www");
			} else {
				this._deviceProjectRootPath = LiveSyncConstants.IOS_PROJECT_PATH;
			}
		}

		return this._deviceProjectRootPath;
	}

	public getLiveSyncNotSupportedError(): string {
		return `You can't LiveSync on device with id ${this.device.deviceInfo.identifier}! Deploy the app with LiveSync enabled and wait for the initial start up before LiveSyncing.`;
	}
}

export class IOSNativeScriptAppIdentifier extends AppBuilderDeviceAppDataBase implements ILiveSyncDeviceAppData {
	private _deviceProjectRootPath: string = null;

	constructor(_appIdentifier: string,
		device: Mobile.IDevice,
		platform: string,
		$deployHelper: IDeployHelper,
		$devicePlatformsConstants: Mobile.IDevicePlatformsConstants,
		private $iOSSimResolver: Mobile.IiOSSimResolver) {
		super(_appIdentifier, device, platform, $deployHelper, $devicePlatformsConstants);
	}

	public get deviceProjectRootPath(): string {
		if (!this._deviceProjectRootPath) {
			if (this.device.isEmulator) {
				let applicationPath = this.$iOSSimResolver.iOSSim.getApplicationPath(this.device.deviceInfo.identifier, this.appIdentifier);
				this._deviceProjectRootPath = applicationPath;
			} else {
				this._deviceProjectRootPath = LiveSyncConstants.IOS_PROJECT_PATH;
			}
		}

		return this._deviceProjectRootPath;
	}
}

export class IOSCompanionAppIdentifier extends AppBuilderCompanionDeviceAppDataBase implements ILiveSyncDeviceAppData {
	constructor(device: Mobile.IDevice,
		platform: string,
		$deployHelper: IDeployHelper,
		$devicePlatformsConstants: Mobile.IDevicePlatformsConstants,
		private $companionAppsService: ICompanionAppsService) {
		super($companionAppsService.getCompanionAppIdentifier(TARGET_FRAMEWORK_IDENTIFIERS.Cordova, platform), device, platform, $deployHelper, $devicePlatformsConstants);
	}

	public get deviceProjectRootPath(): string {
		return LiveSyncConstants.IOS_PROJECT_PATH;
	}

	public get liveSyncFormat(): string {
		return "icenium://%s?LiveSyncToken=%s&appId=%s&configuration=%s";
	}

	protected getCompanionAppName(): string {
		return "companion app";
	}
}

export class IOSNativeScriptCompanionAppIdentifier extends AppBuilderCompanionDeviceAppDataBase implements ILiveSyncDeviceAppData {
	constructor(device: Mobile.IDevice,
		platform: string,
		$deployHelper: IDeployHelper,
		$devicePlatformsConstants: Mobile.IDevicePlatformsConstants,
		private $companionAppsService: ICompanionAppsService) {
		super($companionAppsService.getCompanionAppIdentifier(TARGET_FRAMEWORK_IDENTIFIERS.Cordova, platform), device, platform, $deployHelper, $devicePlatformsConstants);
	}

	public get deviceProjectRootPath(): string {
		return LiveSyncConstants.IOS_PROJECT_PATH;
	}

	public get liveSyncFormat(): string {
		return "nativescript://%s?LiveSyncToken=%s&appId=%s&configuration=%s";
	}

	protected getCompanionAppName(): string {
		return "NativeScript companion app";
	}
}

export class WP8CompanionAppIdentifier extends AppBuilderCompanionDeviceAppDataBase implements ILiveSyncDeviceAppData {
	constructor(device: Mobile.IDevice,
		$deployHelper: IDeployHelper,
		$devicePlatformsConstants: Mobile.IDevicePlatformsConstants,
		public platform: string,
		private $companionAppsService: ICompanionAppsService) {
		super($companionAppsService.getCompanionAppIdentifier(TARGET_FRAMEWORK_IDENTIFIERS.Cordova, platform), device, platform, $deployHelper, $devicePlatformsConstants);
	}

	public get deviceProjectRootPath(): string {
		return ""; // this is used only on Android for Lollipop
	}

	public get liveSyncFormat(): string {
		return "%s/Mist/MobilePackage/redirect?token=%s&appId=%s&configuration=%s";
	}

	public encodeLiveSyncHostUri(hostUri: string): string {
		return hostUri;
	}

	public isLiveSyncSupported(): IFuture<boolean> {
		return Future.fromResult(true);
	}

	public getLiveSyncNotSupportedError(): string {
		return "";
	}

	protected getCompanionAppName(): string {
		return "companion app";
	}
}

export class DeviceAppDataProvider implements Mobile.IDeviceAppDataProvider {
	constructor(private $project: any) { }

	public createFactoryRules(): IDictionary<Mobile.IDeviceAppDataFactoryRule> {
		let rules: IDictionary<IDictionary<Mobile.IDeviceAppDataFactoryRule>> = {
			Cordova: {
				Android: {
					vanilla: AndroidAppIdentifier,
					companion: AndroidCompanionAppIdentifier
				},
				iOS: {
					vanilla: IOSAppIdentifier,
					companion: IOSCompanionAppIdentifier
				},
				WP8: {
					vanilla: "",
					companion: WP8CompanionAppIdentifier
				}
			},
			NativeScript: {
				Android: {
					vanilla: AndroidAppIdentifier,
					companion: AndroidNativeScriptCompanionAppIdentifier
				},
				iOS: {
					vanilla: IOSNativeScriptAppIdentifier,
					companion: IOSNativeScriptCompanionAppIdentifier
				}
			}
		};

		return rules[this.$project.projectData.Framework];
	}
}

$injector.register("deviceAppDataProvider", DeviceAppDataProvider);
