import {DeviceAndroidDebugBridge} from "./device-android-debug-bridge";
import * as applicationManagerPath from "./android-application-manager";
import * as fileSystemPath from "./android-device-file-system";
import * as constants from "../../constants";

interface IAndroidDeviceDetails {
	model: string;
	name: string;
	release: string;
	brand: string;
}

interface IAdbDeviceStatusInfo {
	errorHelp: string;
	deviceStatus: string;
}

export class AndroidDevice implements Mobile.IAndroidDevice {
	public adb: Mobile.IDeviceAndroidDebugBridge;
	public applicationManager: Mobile.IDeviceApplicationManager;
	public fileSystem: Mobile.IDeviceFileSystem;
	public deviceInfo: Mobile.IDeviceInfo;

	// http://stackoverflow.com/questions/31178195/what-does-adb-device-status-mean
	private static ADB_DEVICE_STATUS_INFO: IDictionary<IAdbDeviceStatusInfo> = {
		"device": {
			errorHelp: null,
			deviceStatus: constants.CONNECTED_STATUS
		},
		"offline": {
			errorHelp: "The device instance is not connected to adb or is not responding.",
			deviceStatus: constants.UNREACHABLE_STATUS
		},
		"unauthorized": {
			errorHelp: "Allow USB Debugging on your device.",
			deviceStatus: constants.UNREACHABLE_STATUS
		},
		"recovery": {
			errorHelp: "Your device is in recovery mode. This mode is used to recover your phone when it is broken or to install custom roms.",
			deviceStatus: constants.UNREACHABLE_STATUS
		},
		"no permissions": {
			errorHelp: "Insufficient permissions to communicate with the device.",
			deviceStatus: constants.UNREACHABLE_STATUS
		},
	};

	constructor(private identifier: string,
		private status: string,
		private $androidEmulatorServices: Mobile.IAndroidEmulatorServices,
		private $logger: ILogger,
		private $fs: IFileSystem,
		private $childProcess: IChildProcess,
		private $errors: IErrors,
		private $staticConfig: Config.IStaticConfig,
		private $devicePlatformsConstants: Mobile.IDevicePlatformsConstants,
		private $options: ICommonOptions,
		private $logcatHelper: Mobile.ILogcatHelper,
		private $hostInfo: IHostInfo,
		private $mobileHelper: Mobile.IMobileHelper,
		private $injector: IInjector) {

		this.adb = this.$injector.resolve(DeviceAndroidDebugBridge, { identifier: this.identifier });
		this.applicationManager = this.$injector.resolve(applicationManagerPath.AndroidApplicationManager, { adb: this.adb, identifier: this.identifier });
		this.fileSystem = this.$injector.resolve(fileSystemPath.AndroidDeviceFileSystem, { adb: this.adb, identifier: this.identifier });
		let details: IAndroidDeviceDetails;
		try {
			details = this.getDeviceDetails(["getprop"]).wait();
		} catch (err) {
			this.$logger.trace(`Error while calling getprop: ${err.message}`);
		}

		if (!details || !details.name) {
			// In older CLI versions we are calling cat /system/build.prop to get details.
			// Keep this logic for compatibility and possibly for devices for which getprop is not working
			details = this.getDeviceDetails(["cat", "/system/build.prop"]).wait();
		}

		this.$logger.trace(details);
		let adbStatusInfo = AndroidDevice.ADB_DEVICE_STATUS_INFO[status];

		this.deviceInfo = {
			identifier: this.identifier,
			displayName: details.name,
			model: details.model,
			version: details.release,
			vendor: details.brand,
			platform: this.$devicePlatformsConstants.Android,
			status: adbStatusInfo ? adbStatusInfo.deviceStatus : status,
			errorHelp: adbStatusInfo ? adbStatusInfo.errorHelp : "Unknown status",
			isTablet: this.getIsTablet(details),
			type: this.getType().wait()
		};

		this.$logger.trace(this.deviceInfo);
	}

	public get isEmulator(): boolean {
		return this.deviceInfo.type === "Emulator";
	}

	public getApplicationInfo(applicationIdentifier: string): IFuture<Mobile.IApplicationInfo> {
		return ((): Mobile.IApplicationInfo => {
			let files = this.fileSystem.listFiles(constants.LiveSyncConstants.ANDROID_FILES_PATH, applicationIdentifier).wait(),
				androidFilesMatch = files.match(/(\S+)\.abproject/),
				result: Mobile.IApplicationInfo = null;

			if (androidFilesMatch && androidFilesMatch[1]) {
				result = {
					deviceIdentifier: this.deviceInfo.identifier,
					configuration: androidFilesMatch[1],
					applicationIdentifier
				};
			}

			return result;
		}).future<Mobile.IApplicationInfo>()();
	}

	public openDeviceLogStream(): void {
		if (this.deviceInfo.status === constants.CONNECTED_STATUS) {
			this.$logcatHelper.start(this.identifier);
		}
	}

	public closeDeviceLogStream(): void {
		this.$logcatHelper.stop(this.identifier);
	}

	private getDeviceDetails(shellCommandArgs: string[]): IFuture<IAndroidDeviceDetails> {
		return (() => {
			let details = this.adb.executeShellCommand(shellCommandArgs).wait();

			let parsedDetails: any = {};
			details.split(/\r?\n|\r/).forEach((value: any) => {
				// sample line is "ro.build.version.release=4.4" in /system/build.prop
				// sample line from getprop is:  [ro.build.version.release]: [6.0]
				// NOTE: some props do not have value: [ro.build.version.base_os]: []
				let match = /(?:\[?ro\.build\.version|ro\.product|ro\.build)\.(.+?)]?(?:\:|=)(?:\s*?\[)?(.*?)]?$/.exec(value);
				if (match) {
					parsedDetails[match[1]] = match[2];
				}
			});

			this.$logger.trace(parsedDetails);
			return parsedDetails;
		}).future<IAndroidDeviceDetails>()();
	}

	private getIsTablet(details: any): boolean {
		//version 3.x.x (also known as Honeycomb) is a tablet only version
		return details && (_.startsWith(details.release, "3.") || _.includes((details.characteristics || '').toLowerCase(), "tablet"));
	}

	private getType(): IFuture<string> {
		return (() => {
			let runningEmulators = this.$androidEmulatorServices.getAllRunningEmulators().wait();
			if (_.includes(runningEmulators, this.identifier)) {
				return "Emulator";
			}

			return "Device";
		}).future<string>()();
	}
}
