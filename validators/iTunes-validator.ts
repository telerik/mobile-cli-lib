///<reference path="../../.d.ts"/>

"use strict";

import path = require("path");
import hostInfo = require("../host-info");

export class ITunesValidator implements Mobile.IiTunesValidator {
	private static NOT_INSTALLED_iTUNES_ERROR_MESSAGE = "iTunes is not installed. Install it on your system and run this command again.";

	constructor(private $fs: IFileSystem) { }

	public getError(): IFuture<string> {
		return (() => {
			if(hostInfo.isWindows64()) {
				if(process.arch === "x64") {
					return "To be able to run operations on connected iOS devices, install the 32-bit version of Node.js.";
				}
			}

			var coreFoundationDir = "";
			var mobileDeviceDir = "";

			if(hostInfo.isWindows()) {
				var commonProgramFiles = hostInfo.isWindows64() ?  process.env["CommonProgramFiles(x86)"] : process.env.CommonProgramFiles;
				coreFoundationDir = path.join(commonProgramFiles, "Apple", "Apple Application Support");
				mobileDeviceDir = path.join(commonProgramFiles, "Apple", "Mobile Device Support");
			} else if(hostInfo.isDarwin()) {
				coreFoundationDir = "/System/Library/Frameworks/CoreFoundation.framework/CoreFoundation";
				mobileDeviceDir = "/System/Library/PrivateFrameworks/MobileDevice.framework/MobileDevice";
			}

			var existsCoreFoundation = this.$fs.exists(coreFoundationDir).wait();
			var existsMobileDevice = this.$fs.exists(mobileDeviceDir).wait();

			if(!existsCoreFoundation || !existsMobileDevice) {
				return ITunesValidator.NOT_INSTALLED_iTUNES_ERROR_MESSAGE;
			}

			return null;

		}).future<string>()();
	}
}
$injector.register("iTunesValidator", ITunesValidator);
