///<reference path="../../.d.ts"/>
"use strict";

import Future = require("fibers/future");
import osenv = require("osenv");
import path = require("path");
import shell = require("shelljs");
import util = require("util");

class IosEmulatorServices implements Mobile.IiOSSimulatorService {
	private _cachedSimulatorId: string;
	
	constructor(private $logger: ILogger,
		private $emulatorSettingsService: Mobile.IEmulatorSettingsService,
		private $errors: IErrors,
		private $childProcess: IChildProcess,
		private $mobileHelper: Mobile.IMobileHelper,
		private $devicePlatformsConstants: Mobile.IDevicePlatformsConstants,
		private $hostInfo: IHostInfo,
		private $options: ICommonOptions,
		private $fs: IFileSystem,
		private $bplistParser: IBinaryPlistParser) { }

	public checkDependencies(): IFuture<void> {
		return (() => {
		}).future<void>()();
	}

	public checkAvailability(dependsOnProject: boolean = true): IFuture<void> {
		return (() => {
			if(!this.$hostInfo.isDarwin) {
				this.$errors.fail("iOS Simulator is available only on Mac OS X.");
			}

			let platform = this.$devicePlatformsConstants.iOS;
			if(dependsOnProject && !this.$emulatorSettingsService.canStart(platform).wait()) {
				this.$errors.fail("The current project does not target iOS and cannot be run in the iOS Simulator.");
			}
		}).future<void>()();
	}

	public startEmulator(app: string, emulatorOptions?: Mobile.IEmulatorOptions): IFuture<void> {
		return (() => {
			this.killLaunchdSim().wait();
			this.startEmulatorCore(app, emulatorOptions);
		}).future<void>()();
	}

	public postDarwinNotification(notification: string): IFuture<void> {
		let iosSimPath = require.resolve("ios-sim-portable");
		let nodeCommandName = process.argv[0];

		let opts = [ "notify-post", notification ];

		if (this.$options.device) {
			opts.push("--device", this.$options.device);
		}

		return this.$childProcess.exec(`${nodeCommandName} ${iosSimPath} ${opts.join(' ')}`);
	}
		
	public sync(appIdentifier: string, projectFilesPath: string, notRunningSimulatorAction: () => IFuture<void>): IFuture<void> {
		let syncAction = (applicationPath: string) => shell.cp("-Rf", projectFilesPath, applicationPath);	
		return this.syncCore(appIdentifier, notRunningSimulatorAction, syncAction);
	}
	
	public syncFiles(appIdentifier: string, projectFilesPath: string,  projectFiles: string[], notRunningSimulatorAction: () => IFuture<void>): IFuture<void> {
		let syncAction = (applicationPath: string) => _.each(projectFiles, projectFile => {
			this.$logger.trace(`Transfering ${projectFile} to ${path.join(applicationPath, "app")}`);
			shell.cp("-Rf", projectFile, path.join(applicationPath, "app"));
		});	
		return this.syncCore(appIdentifier, notRunningSimulatorAction, syncAction);	
	}
	
	public isSimulatorRunning(): IFuture<boolean> {
		return (() => {
			try {
				let output = this.$childProcess.exec("ps cax | grep launchd_sim").wait();
				return output.indexOf('launchd_sim') !== -1;
			} catch(e) {
				return false;
			}
		}).future<boolean>()();
	}

	private killLaunchdSim(): IFuture<void> {
		this.$logger.info("Cleaning up before starting the iOS Simulator");

		let future = new Future<void>();
		let killAllProc = this.$childProcess.spawn("killall", ["launchd_sim"]);
		killAllProc.on("close", (code: number) => {
			future.return();
		});
		return future;
	}

	private startEmulatorCore(app: string, emulatorOptions?: Mobile.IEmulatorOptions): void {
		this.$logger.info("Starting iOS Simulator");
		let iosSimPath = require.resolve("ios-sim-portable");
		let nodeCommandName = process.argv[0];

		if(this.$options.availableDevices) {
			this.$childProcess.spawnFromEvent(nodeCommandName, [iosSimPath, "device-types"], "close", { stdio: "inherit" }).wait();
			return;
		}

		let opts = [
			iosSimPath,
			"launch", app,
			"--timeout", this.$options.timeout
		];

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
		}

		if(emulatorOptions && emulatorOptions.args) {
			opts.push(`--args=${emulatorOptions.args}`);
		}

		this.$childProcess.spawn(nodeCommandName, opts, { stdio: "inherit" });
	}
	
	private getRunningSimulatorId(appIdentifier: string): IFuture<string> {
		return ((): string => {
			if(this.$options.device) {
				this._cachedSimulatorId = this.$options.device;
			}
			
			if(!this._cachedSimulatorId) {
				let output = this.$childProcess.exec("xcrun simctl list").wait();
				let lines = output.split("\n");			
				let regex = /[\s\S]+?\(([0-9A-F\-]+?)\)\s+?\(Booted\)/;
				_.each(lines, (line: string) => {
					let match: any = regex.exec(line);
					if(match) {
						this._cachedSimulatorId = match[1];
						return false;
					}
				});
				
				if(!this._cachedSimulatorId) {
					regex = /[\s\S]+?\(([0-9A-F\-]+?)\)\s+?\(Shutdown\)/;
					_.each(lines, (line: string) => {
						let match: any = regex.exec(line);
						if(match) {
							this._cachedSimulatorId = match[1];
							return false;
						}
					});
				}
			}
			
			return this._cachedSimulatorId;
		}).future<string>()();
	}
	
	private getApplicationPath(appIdentifier: string, runningSimulatorId: string): IFuture<string> {
		return (() => {
			let rootApplicationsPath = path.join(osenv.home(), `/Library/Developer/CoreSimulator/Devices/${runningSimulatorId}/data/Containers/Bundle/Application`);
			let applicationGuids = this.$fs.readDirectory(rootApplicationsPath).wait();
			let result: string = null;
			_.each(applicationGuids, applicationGuid => {
				let fullApplicationPath = path.join(rootApplicationsPath, applicationGuid);
				let applicationDirContents = this.$fs.readDirectory(fullApplicationPath).wait();
				let applicationName = _.find(applicationDirContents, fileName => path.extname(fileName) === ".app");
				let plistFilePath = path.join(fullApplicationPath, applicationName, "Info.plist");
				let applicationData = this.$bplistParser.parseFile(plistFilePath).wait();
				if(applicationData[0].CFBundleIdentifier === appIdentifier) {
					result = path.join(fullApplicationPath, applicationName);
					return false;
				}
			});
			
			return result;
		}).future<string>()();
	}
	
	private syncCore(appIdentifier: string, notRunningSimulatorAction: () => IFuture<void>, syncAction: (applicationPath: string) => void): IFuture<void> {
		return (() => {
			if(!this.isSimulatorRunning().wait()) {				
				notRunningSimulatorAction().wait();
			}
			
			let runningSimulatorId = this.getRunningSimulatorId(appIdentifier).wait();
			let applicationPath = this.getApplicationPath(appIdentifier, runningSimulatorId).wait();
			syncAction(applicationPath);
		
			try {
				this.$childProcess.exec("killall -KILL launchd_sim").wait();
				this.$childProcess.exec(`xcrun simctl launch ${runningSimulatorId} ${appIdentifier}`).wait();				
			} catch(e) {
				this.$logger.trace("Unable to kill simulator: " + e);
			}
			
		}).future<void>()();
	}
}
$injector.register("iOSEmulatorServices", IosEmulatorServices);