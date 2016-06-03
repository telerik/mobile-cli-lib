export class RunApplicationOnDeviceCommand implements ICommand {

	constructor(private $devicesService: Mobile.IDevicesService,
		private $errors: IErrors,
		private $stringParameter: ICommandParameter,
		private $staticConfig: Config.IStaticConfig,
		private $options: ICommonOptions,
		private $projectConstants: Project.IConstants,
		private $devicePlatformsConstants: Mobile.IDevicePlatformsConstants) { }

	allowedParameters: ICommandParameter[] = [this.$stringParameter];

	public execute(args: string[]): IFuture<void> {
		return (() => {
			this.$devicesService.initialize({ deviceId: this.$options.device, skipInferPlatform: true }).wait();

			if (this.$devicesService.deviceCount > 1) {
				this.$errors.failWithoutHelp("More than one device found. Specify device explicitly with --device option. To discover device ID, use $%s device command.", this.$staticConfig.CLIENT_NAME.toLowerCase());
			}

			this.$devicesService.execute((device: Mobile.IDevice) => device.applicationManager.startApplication(args[0])).wait();
		}).future<void>()();
	}
}

$injector.registerCommand("device|run", RunApplicationOnDeviceCommand);
