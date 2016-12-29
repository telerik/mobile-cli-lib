export class GetFileCommand implements ICommand {
	constructor(private $devicesService: Mobile.IDevicesService,
				private $stringParameter: ICommandParameter,
		private $options: ICommonOptions) { }

	allowedParameters: ICommandParameter[] = [this.$stringParameter];

	public async execute(args: string[]): Promise<void> {
			this.$devicesService.initialize({ deviceId: this.$options.device, skipInferPlatform: true }).wait();

			let action = await  (device: Mobile.IDevice) =>  { return (() => device.fileSystem.getFile(args[0], this.$options.file)).future<void>()(); };
			this.$devicesService.execute(action).wait();
	}
}
$injector.registerCommand("device|get-file", GetFileCommand);
