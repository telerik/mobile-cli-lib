import * as path from "path";
import future = require("fibers/future");

class Wp8EmulatorServices implements Mobile.IEmulatorPlatformServices {
	private static WP8_LAUNCHER = "XapDeployCmd.exe";
	private static WP8_LAUNCHER_PATH = "Microsoft SDKs\\Windows Phone\\v8.0\\Tools\\XAP Deployment";

	private static get programFilesPath(): string {
		return (process.arch === "x64") ? process.env["PROGRAMFILES(X86)"] : process.env.ProgramFiles;
	}

	constructor(private $logger: ILogger,
		private $emulatorSettingsService: Mobile.IEmulatorSettingsService,
		private $errors: IErrors,
		private $childProcess: IChildProcess,
		private $devicePlatformsConstants: Mobile.IDevicePlatformsConstants,
		private $hostInfo: IHostInfo,
		private $fs: IFileSystem) { }

	public async getEmulatorId(): Promise<string> {
		return Promise.resolve("");
	}

	public async checkDependencies(): Promise<void> {
		return Promise.resolve();
	}

	public checkAvailability(): void {
		if (!this.$fs.exists(this.getPathToEmulatorStarter())) {
			this.$errors.failWithoutHelp("You do not have Windows Phone 8 SDK installed. Please install it in order to continue.");
		}

		if (!this.$hostInfo.isWindows) {
			this.$errors.fail("Windows Phone Emulator is available only on Windows 8 or later.");
		}

		let platform = this.$devicePlatformsConstants.WP8;
		if (!this.$emulatorSettingsService.canStart(platform)) {
			this.$errors.fail("The current project does not target Windows Phone 8 and cannot be run in the Windows Phone emulator.");
		}
	}

	public async startEmulator(): Promise<string> {
		return Promise.resolve("Not implemented.");
	}

	public async runApplicationOnEmulator(app: string, emulatorOptions?: Mobile.IEmulatorOptions): Promise<void> {
			this.$logger.info("Starting Windows Phone Emulator");
			let emulatorStarter = this.getPathToEmulatorStarter();
			this.$childProcess.spawn(emulatorStarter, ["/installlaunch", app, "/targetdevice:xd"], { stdio: "ignore", detached: true }).unref();
	}

	private getPathToEmulatorStarter(): string {
		return path.join(Wp8EmulatorServices.programFilesPath, Wp8EmulatorServices.WP8_LAUNCHER_PATH, Wp8EmulatorServices.WP8_LAUNCHER);
	}
}

$injector.register("wp8EmulatorServices", Wp8EmulatorServices);
