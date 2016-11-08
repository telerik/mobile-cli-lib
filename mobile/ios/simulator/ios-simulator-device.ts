import * as applicationManagerPath from "./ios-simulator-application-manager";
import * as fileSystemPath from "./ios-simulator-file-system";
import * as constants from "../../../constants";

export class IOSSimulator implements Mobile.IiOSSimulator {
	private _applicationManager: Mobile.IDeviceApplicationManager;
	private _fileSystem: Mobile.IDeviceFileSystem;
	private _deviceLogStreamChildProcess: any;

	constructor(private simulator: Mobile.IiSimDevice,
		private $devicePlatformsConstants: Mobile.IDevicePlatformsConstants,
		private $injector: IInjector,
		private $iOSSimResolver: Mobile.IiOSSimResolver,
		private $iOSSimulatorLogProvider: Mobile.IiOSSimulatorLogProvider) { }

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

	public getApplicationInfo(applicationIdentifier: string): IFuture<Mobile.IApplicationInfo> {
		return this.applicationManager.getApplicationInfo(applicationIdentifier);
	}

	public get applicationManager(): Mobile.IDeviceApplicationManager {
		if (!this._applicationManager) {
			this._applicationManager = this.$injector.resolve(applicationManagerPath.IOSSimulatorApplicationManager, { iosSim: this.$iOSSimResolver.iOSSim, identifier: this.simulator.id });
		}

		return this._applicationManager;
	}

	public get fileSystem(): Mobile.IDeviceFileSystem {
		if (!this._fileSystem) {
			this._fileSystem = this.$injector.resolve(fileSystemPath.IOSSimulatorFileSystem, { iosSim: this.$iOSSimResolver.iOSSim, identifier: this.simulator.id });
		}

		return this._fileSystem;
	}

	public openDeviceLogStream(): void {
		this._deviceLogStreamChildProcess = this.$iOSSimulatorLogProvider.startLogProcess(this.simulator.id);
	}

	public closeDeviceLogStream(): void {
		if (this._deviceLogStreamChildProcess) {
			this._deviceLogStreamChildProcess.kill();
			this._deviceLogStreamChildProcess = null;
		}
	}
}
