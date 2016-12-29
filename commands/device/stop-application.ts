export class StopApplicationOnDeviceCommand implements ICommand {

	constructor(private $devicesService: Mobile.IDevicesService,
		private $errors: IErrors,
		private $stringParameter: ICommandParameter,
		private $staticConfig: Config.IStaticConfig,
		private $options: ICommonOptions) { }

	allowedParameters: ICommandParameter[] = [this.$stringParameter, this.$stringParameter];

	public async execute(args: string[]): Promise<void> {
			this.$devicesService.initialize({ deviceId: this.$options.device, skipInferPlatform: true, platform: args[1] }).wait();

			let action = (device: Mobile.IDevice) => device.applicationManager.stopApplication(args[0]);
			this.$devicesService.execute(action).wait();
	}
}
$injector.registerCommand("device|stop", StopApplicationOnDeviceCommand);
