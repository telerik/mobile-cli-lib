import { Socket } from "net";

export class IOSDeviceSocket extends Socket {
	private deviceIdentifier: string;
	private fd: string;
	private iosDeviceOperations: IIOSDeviceOperations;

	public initialize(fd: string, deviceIdentifier: string, iosDeviceOperatios: IIOSDeviceOperations): void {
		this.fd = fd;
		this.deviceIdentifier = deviceIdentifier;
		this.iosDeviceOperations = iosDeviceOperatios;
	}

	public async write(message: string): Promise<number> {
		const response = await this.iosDeviceOperations.sendMessageToSocket([{ socket: +this.fd, message: message, deviceId: this.deviceIdentifier }]);

		return +_.first(response[this.deviceIdentifier]).response;
	}
}
