///<reference path="../../.d.ts"/>
"use strict";

import androidDebugBridgePath = require("./android-debug-bridge");
import applicationManagerPath = require("./android-application-manager");
import fileSystemPath = require("./android-device-file-system");
import * as util from "util";

interface IAndroidDeviceDetails {
	model: string;
	name: string
	release: string;
	brand: string;
}

export class AndroidDevice implements Mobile.IAndroidDevice {
	public adb: Mobile.IAndroidDebugBridge;
	public applicationManager: Mobile.IDeviceApplicationManager;
	public fileSystem: Mobile.IDeviceFileSystem;
	public deviceInfo: Mobile.IDeviceInfo;

	constructor(private identifier: string,
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

		this.adb = this.$injector.resolve(androidDebugBridgePath.AndroidDebugBridge, { identifier: this.identifier });
		this.applicationManager = this.$injector.resolve(applicationManagerPath.AndroidApplicationManager, { adb: this.adb, identifier: this.identifier });
		this.fileSystem = this.$injector.resolve(fileSystemPath.AndroidDeviceFileSystem, { adb: this.adb, identifier: this.identifier });

		let details: IAndroidDeviceDetails = this.getDeviceDetails().wait();
		this.deviceInfo = {
			identifier: this.identifier,
			displayName: details.name,
			model: details.model,
			version: details.release,
			vendor: details.brand,
			platform: this.$devicePlatformsConstants.Android
		}
	}

	public deploy(packageFile: string, packageName: string): IFuture<void> {
		return (() => {
			this.applicationManager.uninstallApplication(packageName).wait();
			this.applicationManager.installApplication(packageFile).wait();
			this.applicationManager.startApplication(packageName).wait();
			this.$logger.info("Successfully deployed on device with identifier '%s'", this.identifier);
		}).future<void>()();
    }

	public openDeviceLogStream(): void {
		this.$logcatHelper.start(this.identifier);
	}

	private getDeviceDetails(): IFuture<IAndroidDeviceDetails> {
		return (() => {
			let details = this.adb.executeShellCommand(["cat", "/system/build.prop"]).wait();
			let parsedDetails: any = {};
			details.split(/\r?\n|\r/).forEach((value: any) => {
				//sample line is "ro.build.version.release=4.4"
				let match = /(?:ro\.build\.version|ro\.product)\.(.+)=(.+)/.exec(value);
				if (match) {
					parsedDetails[match[1]] = match[2];
				}
			});

			return parsedDetails;
		}).future<IAndroidDeviceDetails>()();
	}
}
