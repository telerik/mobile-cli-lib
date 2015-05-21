///<reference path="../../.d.ts"/>

"use strict";

import path = require("path");

export class ITunesValidator implements Mobile.IiTunesValidator {
	private static NOT_INSTALLED_iTUNES_ERROR_MESSAGE = "iTunes is not installed. Install it on your system and run this command again.";
	private static BITNESS_MISMATCH_ERROR_MESSAGE = "The bitness of Node.js and iTunes must match. Verify that both Node.js and iTunes are 32-bit or 64-bit and try again.";
	private static UNSUPPORTED_OS_ERROR_MESSAGE = "iTunes is not available for this operating system. You will not be able to work with connected iOS devices.";

	constructor(private $fs: IFileSystem,
		private $hostInfo: IHostInfo) { }

	public getError(): IFuture<string> {
		return (() => {
			if(this.$hostInfo.isWindows) {
				let commonProgramFiles = "";
				let isNode64 =  process.arch === "x64";

				if(isNode64) { //x64-windows
					commonProgramFiles = process.env.CommonProgramFiles;
					if(this.isiTunesInstalledOnWindows(process.env["CommonProgramFiles(x86)"]).wait() && !this.isiTunesInstalledOnWindows(commonProgramFiles).wait()) {
						return ITunesValidator.BITNESS_MISMATCH_ERROR_MESSAGE;
					}
				} else {
					if(this.$hostInfo.isWindows32) { // x86-node, x86-windows
						commonProgramFiles = process.env.CommonProgramFiles;
					} else { // x86-node, x64-windows
						// check for x64-iTunes
						commonProgramFiles = process.env["CommonProgramFiles(x86)"];

						if(this.isiTunesInstalledOnWindows(process.env.CommonProgramFiles).wait() && !this.isiTunesInstalledOnWindows(commonProgramFiles).wait()) {
							return ITunesValidator.BITNESS_MISMATCH_ERROR_MESSAGE;
						}
					}
				}

				if(!this.isiTunesInstalledOnWindows(commonProgramFiles).wait()) {
					return ITunesValidator.NOT_INSTALLED_iTUNES_ERROR_MESSAGE;
				}
			} else if(this.$hostInfo.isDarwin) {
				let coreFoundationDir = "/System/Library/Frameworks/CoreFoundation.framework/CoreFoundation";
				let mobileDeviceDir = "/System/Library/PrivateFrameworks/MobileDevice.framework/MobileDevice";

				if(!this.isiTunesInstalledCore(coreFoundationDir, mobileDeviceDir).wait()) {
					return ITunesValidator.NOT_INSTALLED_iTUNES_ERROR_MESSAGE;
				}

				return null;
			}

			return ITunesValidator.UNSUPPORTED_OS_ERROR_MESSAGE;
		}).future<string>()();
	}

	private isiTunesInstalledOnWindows(commonProgramFiles: string): IFuture<boolean> {
		let coreFoundationDir = path.join(commonProgramFiles, "Apple", "Apple Application Support");
		let mobileDeviceDir = path.join(commonProgramFiles, "Apple", "Mobile Device Support");

		return this.isiTunesInstalledCore(coreFoundationDir, mobileDeviceDir);
	}

	private isiTunesInstalledCore(coreFoundationDir: string, mobileDeviceDir: string): IFuture<boolean> {
		return (() => {
			return this.$fs.exists(coreFoundationDir).wait() && this.$fs.exists(mobileDeviceDir).wait();
		}).future<boolean>()();
	}
}
$injector.register("iTunesValidator", ITunesValidator);
