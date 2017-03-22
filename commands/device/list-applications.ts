import { EOL } from "os";
import * as util from "util";

export class ListApplicationsCommand implements ICommand {
	constructor(private $devicesService: Mobile.IDevicesService,
		private $logger: ILogger,
		private $options: ICommonOptions) { }

	allowedParameters: ICommandParameter[] = [];

	public async execute(args: string[]): Promise<void> {
		await this.$devicesService.initialize({ deviceId: this.$options.device, skipInferPlatform: true });
		let output: string[] = [];

		let action = async (device: Mobile.IDevice) => {
			let applications = await device.applicationManager.getInstalledApplications();
			output.push(util.format("%s=====Installed applications on device with UDID '%s' are:", EOL, device.deviceInfo.identifier));
			_.each(applications, (applicationId: string) => output.push(applicationId));
		};
		await this.$devicesService.execute(action);

		this.$logger.out(output.join(EOL));
	}
}
$injector.registerCommand(["device|list-applications", "devices|list-applications"], ListApplicationsCommand);
