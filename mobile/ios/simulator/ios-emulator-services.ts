import * as net from "net";
import { connectEventuallyUntilTimeout } from "../../../helpers";

class IosEmulatorServices implements Mobile.IiOSSimulatorService {
	private static DEFAULT_TIMEOUT = 10000;

	constructor(private $logger: ILogger,
		private $emulatorSettingsService: Mobile.IEmulatorSettingsService,
		private $errors: IErrors,
		private $devicePlatformsConstants: Mobile.IDevicePlatformsConstants,
		private $hostInfo: IHostInfo,
		private $options: ICommonOptions,
		private $iOSSimResolver: Mobile.IiOSSimResolver) { }

	public async getEmulatorId(): Promise<string> {
		return "";
	}

	public async getRunningEmulatorId(image: string): Promise<string> {
		//todo: plamen5kov: fix later if necessary
		return "";
	}

	public async checkDependencies(): Promise<void> {
		return;
	}

	public checkAvailability(dependsOnProject?: boolean): void {
		dependsOnProject = dependsOnProject === undefined ? true : dependsOnProject;

		if (!this.$hostInfo.isDarwin) {
			this.$errors.failWithoutHelp("iOS Simulator is available only on Mac OS X.");
		}

		const platform = this.$devicePlatformsConstants.iOS;
		if (dependsOnProject && !this.$emulatorSettingsService.canStart(platform)) {
			this.$errors.failWithoutHelp("The current project does not target iOS and cannot be run in the iOS Simulator.");
		}
	}

	public async startEmulator(emulatorImage?: string): Promise<string> {
		return this.$iOSSimResolver.iOSSim.startSimulator({
			device: emulatorImage,
			state: "None",
			sdkVersion: this.$options.sdk
		});
	}

	public runApplicationOnEmulator(app: string, emulatorOptions?: Mobile.IEmulatorOptions): Promise<any> {
		if (this.$options.availableDevices) {
			return this.$iOSSimResolver.iOSSim.printDeviceTypes();
		}

		const options: any = {
			sdkVersion: this.$options.sdk,
			device: (emulatorOptions && emulatorOptions.device) || this.$options.device,
			args: emulatorOptions.args,
			waitForDebugger: emulatorOptions.waitForDebugger,
			skipInstall: emulatorOptions.skipInstall
		};

		if (this.$options.justlaunch) {
			options.exit = true;
		}

		return this.$iOSSimResolver.iOSSim.launchApplication(app, emulatorOptions.appId, options);
	}

	public async postDarwinNotification(notification: string, deviceId: string): Promise<void> {
		return this.$iOSSimResolver.iOSSim.sendNotification(notification, deviceId);
	}

	public async connectToPort(data: Mobile.IConnectToPortData): Promise<net.Socket> {
		try {
			const socket = await connectEventuallyUntilTimeout(() => net.connect(data.port), data.timeout || IosEmulatorServices.DEFAULT_TIMEOUT);
			return socket;
		} catch (e) {
			this.$logger.debug(e);
		}
	}
}
$injector.register("iOSEmulatorServices", IosEmulatorServices);
