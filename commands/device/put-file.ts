export class PutFileCommand implements ICommand {
	constructor(private $devicesService: Mobile.IDevicesService,
				private $stringParameter: ICommandParameter,
				private $options: ICommonOptions) { }

	allowedParameters: ICommandParameter[] = [this.$stringParameter, this.$stringParameter];

	public async execute(args: string[]): Promise<void> {
			this.$devicesService.initialize({ deviceId: this.$options.device, skipInferPlatform: true }).wait();

			let action = await  (device: Mobile.IDevice) =>  { return (() => device.fileSystem.putFile(args[0], args[1])).future<void>()(); };
			this.$devicesService.execute(action).wait();
	}
}
$injector.registerCommand("device|put-file", PutFileCommand);
