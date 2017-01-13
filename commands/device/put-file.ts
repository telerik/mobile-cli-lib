export class PutFileCommand implements ICommand {
	constructor(private $devicesService: Mobile.IDevicesService,
		private $stringParameter: ICommandParameter,
		private $options: ICommonOptions) { }

	allowedParameters: ICommandParameter[] = [this.$stringParameter, this.$stringParameter];

	public async execute(args: string[]): Promise<void> {
		await this.$devicesService.initialize({ deviceId: this.$options.device, skipInferPlatform: true });

		let action = (device: Mobile.IDevice) => device.fileSystem.putFile(args[0], args[1]);
		await this.$devicesService.execute(action);
	}
}
$injector.registerCommand("device|put-file", PutFileCommand);
