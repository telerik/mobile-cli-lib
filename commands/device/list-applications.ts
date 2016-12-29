import {EOL} from "os";
import * as util from "util";

export class ListApplicationsCommand implements ICommand {
	constructor(private $devicesService: Mobile.IDevicesService,
		private $logger: ILogger,
		private $options: ICommonOptions) { }

	allowedParameters: ICommandParameter[] = [];

	public async execute(args: string[]): Promise<void> {

			this.$devicesService.initialize({ deviceId: this.$options.device, skipInferPlatform: true }).wait();
			let output: string[] = [];

			let action = (device: Mobile.IDevice) => { return (() => {
				let applications = await  device.applicationManager.getInstalledApplications();
				output.push(util.format("%s=====Installed applications on device with UDID '%s' are:", EOL, device.deviceInfo.identifier));
				_.each(applications, (applicationId: string) => output.push(applicationId)); };
			this.$devicesService.execute(action).wait();

			this.$logger.out(output.join(EOL));
		}).future<void>()();
	}
}
$injector.registerCommand("device|list-applications", ListApplicationsCommand);
