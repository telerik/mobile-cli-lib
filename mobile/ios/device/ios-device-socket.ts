import { Socket } from "net";

export class IOSDeviceSocket extends Socket {
	private deviceIdentifier: string;
	private fd: number;
	private iosDeviceOperations: IIOSDeviceOperations;

	public initialize(fd: string, deviceIdentifier: string, iosDeviceOperatios: IIOSDeviceOperations): void {
		this.fd = +fd;
		this.deviceIdentifier = deviceIdentifier;
		this.iosDeviceOperations = iosDeviceOperatios;

		const callback = (socketInfo: IOSDeviceLib.ISocketMessage) => {
			if (+socketInfo.socket === this.fd) {
				this.emit("message", socketInfo.message);
				this.emit("data", socketInfo.message);
			}
		};
		this.iosDeviceOperations.readMessageFromSocket([{ socket: this.fd, deviceId: this.deviceIdentifier, context: this, callback: callback }]);
	}

	public async write(message: string): Promise<number> {
		const response = await this.iosDeviceOperations.sendMessageToSocket([{ socket: this.fd, message: message, deviceId: this.deviceIdentifier }]);

		return +_.first(response[this.deviceIdentifier]).response;
	}
}
