///<reference path="../.d.ts"/>
"use strict";

import * as path from "path";

export class XcodeSelectService implements IXcodeSelectService {
	constructor(private $childProcess: IChildProcess,
		private $errors: IErrors,
		private $hostInfo: IHostInfo) {
	}

	public getDeveloperDirectoryPath(): IFuture<string> {
		return (() => {
			if (!this.$hostInfo.isDarwin) {
				this.$errors.failWithoutHelp("xcode-select is only available on Mac OS X.");
			}

			let childProcess = this.$childProcess.spawnFromEvent("xcode-select", ["-print-path"], "close", {}, { throwError: false }).wait(),
				result = childProcess.stdout.trim();

			if (!result) {
				this.$errors.failWithoutHelp("Cannot find path to Xcode.app - make sure you've installed Xcode correctly.");
			}

			return result;
		}).future<string>()();
	}

	public getContentsDirectoryPath(): IFuture<string> {
		return (() => {
			return path.join(this.getDeveloperDirectoryPath().wait(), "..");
		}).future<string>()();
	}
}

$injector.register("xcodeSelectService", XcodeSelectService);
