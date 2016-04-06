///<reference path="../../.d.ts"/>
"use strict";

import { DeviceAppDataBase } from "../../mobile/device-app-data/device-app-data-base";
import Future = require("fibers/future");
import * as querystring from "querystring";
import * as path from "path";
import * as util from "util";

const DEVICE_TMP_DIR_FORMAT_V2 = "/data/local/tmp/12590FAA-5EDD-4B12-856D-F52A0A1599F2/%s";
const DEVICE_TMP_DIR_FORMAT_V3 = "/mnt/sdcard/Android/data/%s/files/12590FAA-5EDD-4B12-856D-F52A0A1599F2";
const CHECK_LIVESYNC_INTENT_NAME = "com.telerik.IsLiveSyncSupported";
const IOS_PROJECT_PATH = "/Library/Application Support/LiveSync";

export class AndroidAppIdentifier extends DeviceAppDataBase implements ILiveSyncDeviceAppData {
	private _deviceProjectRootPath: string = null;
	private _liveSyncVersion: number;

	constructor(_appIdentifier: string,
		public device: Mobile.IDevice,
		public platform: string,
		private $errors: IErrors,
		private $deployHelper: IDeployHelper,
		private $devicePlatformsConstants: Mobile.IDevicePlatformsConstants) {
		super(_appIdentifier);
	}

	public get deviceProjectRootPath(): string {
		if (!this._deviceProjectRootPath) {
			let deviceTmpDirFormat = "";

			let version = this.getLiveSyncVersion().wait();
			if (version === 2) {
				deviceTmpDirFormat = DEVICE_TMP_DIR_FORMAT_V2;
			} else if (version === 3) {
				deviceTmpDirFormat = DEVICE_TMP_DIR_FORMAT_V3;
			} else {
				this.$errors.failWithoutHelp(`Unsupported LiveSync version: ${version}`);
			}

			this._deviceProjectRootPath = this.getDeviceProjectRootPath(util.format(deviceTmpDirFormat, this.appIdentifier));
		}

		return this._deviceProjectRootPath;
	}

	public get liveSyncFormat(): string {
		return null;
	}

	public encodeLiveSyncHostUri(hostUri: string): string {
		return hostUri;
	}

	public getLiveSyncNotSupportedError(): string {
		return `You can't LiveSync on device with id ${this.device.deviceInfo.identifier}! Deploy the app with LiveSync enabled and wait for the initial start up before LiveSyncing.`;
	}

	public isLiveSyncSupported(): IFuture<boolean> {
		return (() => {
			let isApplicationInstalled = this.device.applicationManager.isApplicationInstalled(this.appIdentifier).wait();
			if (!isApplicationInstalled) {
				this.$deployHelper.deploy(this.$devicePlatformsConstants.Android.toLowerCase()).wait();
			}
		 	return this.getLiveSyncVersion().wait() !== 0;
		}).future<boolean>()();
	}

	private getLiveSyncVersion(): IFuture<number> {
		return (() => {
			if (!this._liveSyncVersion) {
				this._liveSyncVersion = (<Mobile.IAndroidDevice>this.device).adb.sendBroadcastToDevice(CHECK_LIVESYNC_INTENT_NAME, {"app-id": this.appIdentifier}).wait();
			}
			return this._liveSyncVersion;
		}).future<number>()();
	}
}

export class AndroidCompanionAppIdentifier extends DeviceAppDataBase implements ILiveSyncDeviceAppData {
	constructor(_appIdentifier: string,
		public device: Mobile.IDevice,
		public platform: string,
		private $companionAppsService: ICompanionAppsService,
		private $projectConstants: Project.IConstants) {
		super($companionAppsService.getCompanionAppIdentifier($projectConstants.TARGET_FRAMEWORK_IDENTIFIERS.Cordova, platform));
	}

	public get deviceProjectRootPath(): string {
		return this.getDeviceProjectRootPath(util.format(DEVICE_TMP_DIR_FORMAT_V3, this.appIdentifier));
	}

	public get liveSyncFormat(): string {
		return "%s/Mist/MobilePackage/redirect?token=%s";
	}

	public encodeLiveSyncHostUri(hostUri: string): string {
		return hostUri;
	}

	public getLiveSyncNotSupportedError(): string {
		return `Cannot LiveSync changes to the companion app. The companion app is not installed on ${this.device.deviceInfo.identifier}.`;
	}

	public isLiveSyncSupported(): IFuture<boolean> {
		return this.device.applicationManager.isApplicationInstalled(this.appIdentifier);
	}
}

export class AndroidNativeScriptCompanionAppIdentifier extends DeviceAppDataBase implements ILiveSyncDeviceAppData {
	constructor(_appIdentifier: string,
		public device: Mobile.IDevice,
		public platform: string,
		private $companionAppsService: ICompanionAppsService,
		private $projectConstants: Project.IConstants) {
		super($companionAppsService.getCompanionAppIdentifier($projectConstants.TARGET_FRAMEWORK_IDENTIFIERS.NativeScript, platform));
	}

	public get deviceProjectRootPath(): string {
		return util.format(DEVICE_TMP_DIR_FORMAT_V3, this.appIdentifier);
	}

	public get liveSyncFormat(): string {
		return "%s/Mist/MobilePackage/nsredirect?token=%s";
	}

	public encodeLiveSyncHostUri(hostUri: string): string {
		return hostUri;
	}

	public getLiveSyncNotSupportedError(): string {
		return `Cannot LiveSync changes to the NativeScript companion app. The NativeScript companion app is not installed on ${this.device.deviceInfo.identifier}.`;
	}

	public isLiveSyncSupported(): IFuture<boolean> {
		return this.device.applicationManager.isApplicationInstalled(this.appIdentifier);
	}
}

export class IOSAppIdentifier extends DeviceAppDataBase implements ILiveSyncDeviceAppData {
	private _deviceProjectRootPath: string = null;

	constructor(_appIdentifier: string,
		public device: Mobile.IDevice,
		public platform: string,
		private $iOSSimResolver: Mobile.IiOSSimResolver) {
		super(_appIdentifier);
	}

	public get deviceProjectRootPath(): string {
		if (!this._deviceProjectRootPath) {
			if (this.device.isEmulator) {
				let applicationPath = this.$iOSSimResolver.iOSSim.getApplicationPath(this.device.deviceInfo.identifier, this.appIdentifier);
				this._deviceProjectRootPath = path.join(applicationPath, "www");
			} else {
				this._deviceProjectRootPath = IOS_PROJECT_PATH;
			}
		}

		return this._deviceProjectRootPath;
	}

	get liveSyncFormat(): string {
		return null;
	}

	encodeLiveSyncHostUri(hostUri: string): string {
		return querystring.escape(hostUri);
	}

	getLiveSyncNotSupportedError(): string {
		return `You can't LiveSync on device with id ${this.device.deviceInfo.identifier}! Deploy the app with LiveSync enabled and wait for the initial start up before LiveSyncing.`;
	}

	isLiveSyncSupported(): IFuture<boolean> {
		return Future.fromResult(true);
	}
}

export class IOSNativeScriptAppIdentifier extends DeviceAppDataBase implements ILiveSyncDeviceAppData {
	private _deviceProjectRootPath: string = null;

	constructor(_appIdentifier: string,
		public device: Mobile.IDevice,
		public platform: string,
		private $iOSSimResolver: Mobile.IiOSSimResolver) {
		super(_appIdentifier);
	}

	public get deviceProjectRootPath(): string {
		if (!this._deviceProjectRootPath) {
			if (this.device.isEmulator) {
				let applicationPath = this.$iOSSimResolver.iOSSim.getApplicationPath(this.device.deviceInfo.identifier, this.appIdentifier);
				this._deviceProjectRootPath = path.join(applicationPath, "app");
			} else {
				this._deviceProjectRootPath = IOS_PROJECT_PATH;
			}
		}

		return this._deviceProjectRootPath;
	}

	get liveSyncFormat(): string {
		return null;
	}

	encodeLiveSyncHostUri(hostUri: string): string {
		return querystring.escape(hostUri);
	}

	getLiveSyncNotSupportedError(): string {
		return `You can't LiveSync on device with id ${this.device.deviceInfo.identifier}! Deploy the app with LiveSync enabled and wait for the initial start up before LiveSyncing.`;
	}

	isLiveSyncSupported(): IFuture<boolean> {
		return Future.fromResult(true);
	}
}

export class IOSCompanionAppIdentifier extends DeviceAppDataBase implements ILiveSyncDeviceAppData {
	constructor(public device: Mobile.IDevice,
		public platform: string,
		private $companionAppsService: ICompanionAppsService,
		private $projectConstants: Project.IConstants) {
		super($companionAppsService.getCompanionAppIdentifier($projectConstants.TARGET_FRAMEWORK_IDENTIFIERS.Cordova, platform));
	}

	public get deviceProjectRootPath(): string {
		return IOS_PROJECT_PATH;
	}

	public get liveSyncFormat(): string {
		return "icenium://%s?LiveSyncToken=%s";
	}

	public encodeLiveSyncHostUri(hostUri: string): string {
		return querystring.escape(hostUri);
	}

	public getLiveSyncNotSupportedError(): string {
		return `Cannot LiveSync changes to the companion app. The companion app is not installed on ${this.device.deviceInfo.identifier}.`;
	}

	public isLiveSyncSupported(): IFuture<boolean> {
		return this.device.applicationManager.isApplicationInstalled(this.appIdentifier);
	}
}

export class IOSNativeScriptCompanionAppIdentifier extends DeviceAppDataBase implements ILiveSyncDeviceAppData {
	constructor(public device: Mobile.IDevice,
		public platform: string,
		private $companionAppsService: ICompanionAppsService,
		private $projectConstants: Project.IConstants) {
		super($companionAppsService.getCompanionAppIdentifier($projectConstants.TARGET_FRAMEWORK_IDENTIFIERS.NativeScript, platform));
	}

	public get deviceProjectRootPath(): string {
		return IOS_PROJECT_PATH;
	}

	public get liveSyncFormat(): string {
		return "nativescript://%s?LiveSyncToken=%s";
	}

	public encodeLiveSyncHostUri(hostUri: string): string {
		return querystring.escape(hostUri);
	}

	public getLiveSyncNotSupportedError(): string {
		return `Cannot LiveSync changes to the NativeScript companion app. The NativeScript companion app is not installed on ${this.device.deviceInfo.identifier}.`;
	}

	public isLiveSyncSupported(): IFuture<boolean> {
		return this.device.applicationManager.isApplicationInstalled(this.appIdentifier);
	}
}

export class WP8CompanionAppIdentifier extends DeviceAppDataBase implements ILiveSyncDeviceAppData {
	constructor(public device: Mobile.IDevice,
		public platform: string) {
		super("{9155af5b-e7ed-486d-bc6b-35087fb59ecc}");
	}

	public get deviceProjectRootPath(): string {
		return ""; // this is used only on Android for Lollipop
	}

	public get liveSyncFormat(): string {
		return "%s/Mist/MobilePackage/redirect?token=%s";
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
}

export class DeviceAppDataProvider implements Mobile.IDeviceAppDataProvider {
	constructor(private $project: any) { }

	public createFactoryRules(): IDictionary<Mobile.IDeviceAppDataFactoryRule> {
		let rules: IDictionary<IDictionary<Mobile.IDeviceAppDataFactoryRule>>= {
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
