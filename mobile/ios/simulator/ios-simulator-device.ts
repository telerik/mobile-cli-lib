///<reference path="../../../.d.ts"/>
"use strict";

import * as applicationManagerPath from "./ios-simulator-application-manager";
import * as fileSystemPath from "./ios-simulator-file-system";
import * as constants from "../../constants";

export class IOSSimulator implements Mobile.IiOSSimulator {
	constructor(private simulator: Mobile.IiSimDevice,
		private $devicePlatformsConstants: Mobile.IDevicePlatformsConstants,
		private $injector: IInjector) { }

	public get deviceInfo(): Mobile.IDeviceInfo {
		return {
			identifier: this.simulator.id,
			displayName: this.simulator.name,
			model: _.last(this.simulator.fullId.split(".")),
			version: this.simulator.runtimeVersion,
			vendor: "Apple",
			platform: this.$devicePlatformsConstants.iOS,
			status: constants.CONNECTED_STATUS,
			errorHelp: null,
			isTablet: this.simulator.fullId.toLowerCase().indexOf("ipad") !== -1,
			type: "Emulator"
		};
	}

	public get isEmulator(): boolean {
		return true;
	}

	public get applicationManager(): Mobile.IDeviceApplicationManager {
		return this.$injector.resolve(applicationManagerPath.IOSSimulatorApplicationManager, { iosSim: this.iosSim, identifier: this.simulator.id });
	}

	public get fileSystem(): Mobile.IDeviceFileSystem {
		return this.$injector.resolve(fileSystemPath.IOSSimulatorFileSystem, { iosSim: this.iosSim, identifier: this.simulator.id });
	}

	public openDeviceLogStream(): void {
		return this.iosSim.printDeviceLog(this.deviceInfo.identifier);
	}

	private _iosSim: any = null;
	private get iosSim(): any {
		if (!this._iosSim) {
			this._iosSim = require("ios-sim-portable");
		}

		return this._iosSim;
	}
}
