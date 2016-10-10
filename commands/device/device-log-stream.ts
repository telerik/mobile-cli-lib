export class OpenDeviceLogStreamCommand implements ICommand {
	private static NOT_SPECIFIED_DEVICE_ERROR_MESSAGE = "More than one device found. Specify device explicitly.";

	constructor(private $devicesService: Mobile.IDevicesService,
		private $errors: IErrors,
		private $commandsService: ICommandsService,
		private $options: ICommonOptions,
		private $loggingLevels: Mobile.ILoggingLevels,
		private $deviceLogService: IDeviceLogService) { }

	allowedParameters: ICommandParameter[] = [];

	public execute(args: string[]): IFuture<void> {
		return (() => {
			let deviceId = this.$options.device;
			this.$devicesService.initialize({ deviceId, skipInferPlatform: true }).wait();

			if (this.$devicesService.deviceCount > 1) {
				this.$commandsService.tryExecuteCommand("device", []).wait();
				this.$errors.fail(OpenDeviceLogStreamCommand.NOT_SPECIFIED_DEVICE_ERROR_MESSAGE);
			}

			this.$deviceLogService.printDeviceLog(deviceId, this.$options.duration, this.$loggingLevels.full).wait();
		}).future<void>()();
	}
}
$injector.registerCommand("device|log", OpenDeviceLogStreamCommand);
