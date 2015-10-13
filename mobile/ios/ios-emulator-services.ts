///<reference path="../../.d.ts"/>
"use strict";

import Future = require("fibers/future");
import * as osenv from "osenv";
import * as path from "path";
import * as shell from "shelljs";

class IosEmulatorServices implements Mobile.IiOSSimulatorService {
	private _cachedSimulatorId: string;

	constructor(private $logger: ILogger,
		private $emulatorSettingsService: Mobile.IEmulatorSettingsService,
		private $errors: IErrors,
		private $childProcess: IChildProcess,
		private $devicePlatformsConstants: Mobile.IDevicePlatformsConstants,
		private $hostInfo: IHostInfo,
		private $options: ICommonOptions,
		private $fs: IFileSystem,
		private $bplistParser: IBinaryPlistParser) { }

	public getEmulatorId(): IFuture<string> {
		return Future.fromResult("");
	}

	public checkDependencies(): IFuture<void> {
		return Future.fromResult();
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

	public startEmulator(app: string, emulatorOptions?: Mobile.IEmulatorOptions): IFuture<any> {
		return (() => {
			this.killLaunchdSim().wait();
			return this.startEmulatorCore(app, emulatorOptions);
		}).future<any>()();
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

	public syncFiles(appIdentifier: string, projectFilesPath: string,  projectFiles: string[], notRunningSimulatorAction: () => IFuture<void>, relativeToProjectBasePathAction?: (_projectFile: string) => string): IFuture<void> {
		let syncAction = (applicationPath: string) => _.each(projectFiles, projectFile => {
			let destinationPath = path.join(applicationPath, relativeToProjectBasePathAction(projectFile));
			this.$logger.trace(`Transfering ${projectFile} to ${destinationPath}`);
			shell.cp("-Rf", projectFile, destinationPath);
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
		return this.$childProcess.spawnFromEvent("killall", ["launchd_sim"], "close", undefined, { throwError: false });
	}

	private startEmulatorCore(app: string, emulatorOptions?: Mobile.IEmulatorOptions): any {
		this.$logger.info("Starting iOS Simulator");
		let iosSimPath = require.resolve("ios-sim-portable");
		let nodeCommandName = process.argv[0];

		if(this.$options.availableDevices) {
			this.$childProcess.spawnFromEvent(nodeCommandName, [iosSimPath, "device-types"], "close", { stdio: "inherit" }).wait();
			return;
		}

		let opts = [
			iosSimPath,
			"launch", app
		];

		if (this.$options.timeout) {
			opts = opts.concat("--timeout", this.$options.timeout);
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

		let options = { stdio: "inherit" };
		if(emulatorOptions.captureStdin) {
			options = { stdio: "pipe" };
		}

		return this.$childProcess.spawn(nodeCommandName, opts, options);
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
			if(!this.$fs.exists(rootApplicationsPath).wait()) {
				rootApplicationsPath = path.join(osenv.home(), `/Library/Developer/CoreSimulator/Devices/${runningSimulatorId}/data/Applications`);
			}
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

	private syncCore(appIdentifier: string, notRunningSimulatorAction: () => IFuture<void>, syncAction: (_applicationPath: string) => void): IFuture<void> {
		return (() => {
			if(!this.isSimulatorRunning().wait()) {
				notRunningSimulatorAction().wait();
			}

			let runningSimulatorId = this.getRunningSimulatorId(appIdentifier).wait();
			let applicationPath = this.getApplicationPath(appIdentifier, runningSimulatorId).wait();
			let applicationName = path.basename(applicationPath);
			syncAction(applicationPath);

			try {
				this.$childProcess.exec(`killall ${applicationName.split(".")[0]}`).wait();
			} catch(e) {
				this.$logger.trace("Unable to kill simulator: " + e);
			}

			setTimeout(() => {
				// Killall doesn't always finish immediately, and the subsequent
				// start fails since the app is already running.
				// Give it some time to die before we attempt restarting.
				this.$childProcess.exec(`xcrun simctl launch ${runningSimulatorId} ${appIdentifier}`);
			}, 500);
		}).future<void>()();
	}
}
$injector.register("iOSEmulatorServices", IosEmulatorServices);
