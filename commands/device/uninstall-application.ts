export class UninstallApplicationCommand implements ICommand {
	constructor(private $devicesService: Mobile.IDevicesService,
				private $stringParameter: ICommandParameter,
				private $options: ICommonOptions) { }

	allowedParameters: ICommandParameter[] = [this.$stringParameter];

	public async execute(args: string[]): Promise<void> {
			this.$devicesService.initialize({ deviceId: this.$options.device, skipInferPlatform: true }).wait();

			let action = (device: Mobile.IDevice) => device.applicationManager.uninstallApplication(args[0]);
			this.$devicesService.execute(action).wait();
	}
}
$injector.registerCommand("device|uninstall", UninstallApplicationCommand);
