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

	public getEmulatorId(): IFuture<string> {
		return future.fromResult("");
	}

	public checkDependencies(): IFuture<void> {
		return future.fromResult();
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

	public startEmulator(): IFuture<string> {
		return future.fromResult("Not implemented.");
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
