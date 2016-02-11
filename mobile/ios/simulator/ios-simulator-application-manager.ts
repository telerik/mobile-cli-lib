///<reference path="../../../.d.ts"/>
"use strict";

import {ApplicationManagerBase} from "../../application-manager-base";
import Future = require("fibers/future");

export class IOSSimulatorApplicationManager extends ApplicationManagerBase implements Mobile.IDeviceApplicationManager {
	constructor(private iosSim: any,
		private identifier: string,
		private $options: ICommonOptions) {
			super();
		}

	private deviceLoggingStarted = false;

	public getInstalledApplications(): IFuture<string[]> {
		return Future.fromResult(this.iosSim.getInstalledApplications(this.identifier));
	}

	public installApplication(packageFilePath: string): IFuture<void> {
		return this.iosSim.installApplication(this.identifier, packageFilePath);
	}

	public uninstallApplication(appIdentifier: string): IFuture<void> {
		return this.iosSim.uninstallApplication(this.identifier, appIdentifier);
	}

	public startApplication(appIdentifier: string): IFuture<void> {
		return (() => {
			let launchResult = this.iosSim.startApplication(this.identifier, appIdentifier).wait();
			if (!this.$options.justlaunch && !this.deviceLoggingStarted) {
				this.deviceLoggingStarted = true;
				this.iosSim.printDeviceLog(this.identifier, launchResult);
			}

		}).future<void>()();
	}

	public stopApplication(cfBundleExecutable: string): IFuture<void> {
		return this.iosSim.stopApplication(this.identifier, cfBundleExecutable);
	}

	public canStartApplication(): boolean {
		return true;
	}
}
