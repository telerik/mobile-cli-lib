///<reference path="../../../.d.ts"/>
"use strict";

import {ApplicationManagerBase} from "../../application-manager-base";
import Future = require("fibers/future");

export class IOSSimulatorApplicationManager extends ApplicationManagerBase implements Mobile.IDeviceApplicationManager {
	constructor(private iosSim: any,
		private identifier: string) {
			super();
		}

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
		return this.iosSim.startApplication(this.identifier, appIdentifier);
	}

	public stopApplication(appIdentifier: string): IFuture<void> {
		return this.iosSim.stopApplication(this.identifier, appIdentifier);
	}

	public canStartApplication(): boolean {
		return true;
	}
}
