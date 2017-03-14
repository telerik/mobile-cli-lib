export class OpenDeviceLogStreamCommand implements ICommand {
	private static NOT_SPECIFIED_DEVICE_ERROR_MESSAGE = "More than one device found. Specify device explicitly.";

	constructor(private $devicesService: Mobile.IDevicesService,
		private $errors: IErrors,
		private $commandsService: ICommandsService,
		private $options: ICommonOptions,
		private $deviceLogProvider: Mobile.IDeviceLogProvider,
		private $loggingLevels: Mobile.ILoggingLevels) { }

	allowedParameters: ICommandParameter[] = [];

	public async execute(args: string[]): Promise<void> {
		this.$deviceLogProvider.setLogLevel(this.$loggingLevels.full);

		await this.$devicesService.initialize({ deviceId: this.$options.device, skipInferPlatform: true });

		if (this.$devicesService.deviceCount > 1) {
			await this.$commandsService.tryExecuteCommand("device", []);
			this.$errors.fail(OpenDeviceLogStreamCommand.NOT_SPECIFIED_DEVICE_ERROR_MESSAGE);
		}

		let action = (device: Mobile.IDevice) => device.openDeviceLogStream();
		await this.$devicesService.execute(action);
	}
}

$injector.registerCommand("device|log", OpenDeviceLogStreamCommand);
