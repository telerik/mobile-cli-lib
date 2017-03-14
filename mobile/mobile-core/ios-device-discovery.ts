import { DeviceDiscovery } from "./device-discovery";
import { IOSDevice } from "../ios/device/ios-device";

export class IOSDeviceDiscovery extends DeviceDiscovery {
	private _iTunesErrorMessage: string;

	constructor(private $injector: IInjector,
		private $logger: ILogger,
		private $iTunesValidator: Mobile.IiTunesValidator,
		private $iosDeviceOperations: IIOSDeviceOperations) {
		super();
	}

	private validateiTunes(): boolean {
		if (!this._iTunesErrorMessage) {
			this._iTunesErrorMessage = this.$iTunesValidator.getError();

			if (this._iTunesErrorMessage) {
				this.$logger.warn(this._iTunesErrorMessage);
			}
		}

		return !this._iTunesErrorMessage;
	}

	public async startLookingForDevices(): Promise<void> {
		if (this.validateiTunes()) {
			await this.$iosDeviceOperations.startLookingForDevices((deviceInfo: IOSDeviceLib.IDeviceActionInfo) => {
				this.createAndAddDevice(deviceInfo);
			}, (deviceInfo: IOSDeviceLib.IDeviceActionInfo) => {
				this.removeDevice(deviceInfo.deviceId);
			});
		}
	}

	private createAndAddDevice(deviceActionInfo: IOSDeviceLib.IDeviceActionInfo): void {
		let device = this.$injector.resolve(IOSDevice, { deviceActionInfo: deviceActionInfo });
		this.addDevice(device);
	}
}

$injector.register("iOSDeviceDiscovery", IOSDeviceDiscovery);
