import Future = require("fibers/future");

class IosEmulatorServices implements Mobile.IiOSSimulatorService {
	constructor(private $logger: ILogger,
		private $emulatorSettingsService: Mobile.IEmulatorSettingsService,
		private $errors: IErrors,
		private $childProcess: IChildProcess,
		private $devicePlatformsConstants: Mobile.IDevicePlatformsConstants,
		private $hostInfo: IHostInfo,
		private $options: ICommonOptions,
		private $iOSSimResolver: Mobile.IiOSSimResolver) { }

	public getEmulatorId(): IFuture<string> {
		return Future.fromResult("");
	}

	public checkDependencies(): IFuture<void> {
		return Future.fromResult();
	}

	public checkAvailability(dependsOnProject?: boolean): IFuture<void> {
		return (() => {
			if(!this.$hostInfo.isDarwin) {
				this.$errors.failWithoutHelp("iOS Simulator is available only on Mac OS X.");
			}

			let platform = this.$devicePlatformsConstants.iOS;
			if(!!dependsOnProject && !this.$emulatorSettingsService.canStart(platform).wait()) {
				this.$errors.failWithoutHelp("The current project does not target iOS and cannot be run in the iOS Simulator.");
			}
		}).future<void>()();
	}

	public startEmulator(): IFuture<string> {
		return this.$iOSSimResolver.iOSSim.startSimulator();
	}

	public runApplicationOnEmulator(app: string, emulatorOptions?: Mobile.IEmulatorOptions): IFuture<any> {
		return (() => {
			return this.runApplicationOnEmulatorCore(app, emulatorOptions);
		}).future<any>()();
	}

	public postDarwinNotification(notification: string): IFuture<void> {
		let iosSimPath = this.$iOSSimResolver.iOSSimPath;
		let nodeCommandName = process.argv[0];

		let opts = [ "notify-post", notification ];

		if (this.$options.device) {
			opts.push("--device", this.$options.device);
		}

		return this.$childProcess.exec(`${nodeCommandName} ${iosSimPath} ${opts.join(' ')}`);
	}

	private runApplicationOnEmulatorCore(app: string, emulatorOptions?: Mobile.IEmulatorOptions): any {
		this.$logger.info("Starting iOS Simulator");
		let iosSimPath = this.$iOSSimResolver.iOSSimPath;
		let nodeCommandName = process.argv[0];

		if(this.$options.availableDevices) {
			this.$childProcess.spawnFromEvent(nodeCommandName, [iosSimPath, "device-types"], "close", { stdio: "inherit" }).wait();
			return;
		}

		let opts = [
			iosSimPath,
			"launch", app, emulatorOptions.appId // TODO: Refactor this -> should be separate parameter
		];

		if (this.$options.timeout) {
			opts = opts.concat("--timeout", this.$options.timeout);
		}

		if(this.$options.sdk) {
			opts = opts.concat("--sdkVersion", this.$options.sdk);
		}

		if(!this.$options.justlaunch) {
			opts.push("--logging");
		} else {
			if(emulatorOptions) {
				if(emulatorOptions.stderrFilePath) {
					opts = opts.concat("--stderr", emulatorOptions.stderrFilePath);
				}
				if(emulatorOptions.stdoutFilePath) {
					opts = opts.concat("--stdout", emulatorOptions.stdoutFilePath);
				}
			}

			opts.push("--exit");
		}

		if(this.$options.device) {
			opts = opts.concat("--device", this.$options.device);
		} else if (emulatorOptions && emulatorOptions.deviceType) {
			opts = opts.concat("--device", emulatorOptions.deviceType);
		}

		if(emulatorOptions && emulatorOptions.args) {
			opts.push(`--args=${emulatorOptions.args}`);
		}

		if(emulatorOptions && emulatorOptions.waitForDebugger) {
			opts.push("--waitForDebugger");
		}

		if (emulatorOptions && emulatorOptions.skipInstall) {
			opts.push("--skipInstall");
		}

		let stdioOpts = { stdio: (emulatorOptions && emulatorOptions.captureStdin) ? "pipe" : "inherit" };

		return this.$childProcess.spawn(nodeCommandName, opts, stdioOpts);
	}
}
$injector.register("iOSEmulatorServices", IosEmulatorServices);
