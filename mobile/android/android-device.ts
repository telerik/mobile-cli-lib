///<reference path="../../../.d.ts"/>
"use strict";
import util = require("util");
import Future = require("fibers/future");
import path = require("path");
import temp = require("temp");
import helpers = require("../../helpers");
import os = require("os");
import Fiber = require("fibers");

interface IAndroidDeviceDetails {
	model: string;
	name: string
	release: string;
	brand: string;
}

class LiveSyncCommands {
	public static DeployProjectCommand(liveSyncUrl: string): string {
		return util.format("DeployProject %s \r", liveSyncUrl);
	}

	public static ReloadStartViewCommand(): string {
		return "ReloadStartView \r";
	}

	public static SyncFilesCommand(): string {
		return "SyncFiles \r";
	}

	public static RefreshCurrentViewCommand(): string {
		return "RefreshCurrentView \r";
	}
}

export class AndroidDevice implements Mobile.IAndroidDevice {
	private static REFRESH_WEB_VIEW_INTENT_NAME = "com.telerik.RefreshWebView";
	private static CHANGE_LIVESYNC_URL_INTENT_NAME = "com.telerik.ChangeLiveSyncUrl";
	private static LIVESYNC_BROADCAST_NAME = "com.telerik.LiveSync";
	private static CHECK_LIVESYNC_INTENT_NAME = "com.telerik.IsLiveSyncSupported";

	private static ENV_DEBUG_IN_FILENAME = "envDebug.in";
	private static ENV_DEBUG_OUT_FILENAME = "envDebug.out";
	private static DEVICE_TMP_DIR_FORMAT_V2 = "/data/local/tmp/12590FAA-5EDD-4B12-856D-F52A0A1599F2/%s";
	private static DEVICE_TMP_DIR_FORMAT_V3 = "/mnt/sdcard/Android/data/%s/files/12590FAA-5EDD-4B12-856D-F52A0A1599F2";
	private static COMMANDS_FILE = "telerik.livesync.commands";
	private static DEVICE_PATH_SEPARATOR = "/";

	private model: string;
	private name: string;
	private version: string;
	private vendor: string;
	private _tmpRoots: IStringDictionary = {};
	private _installedApplications: string[];
	private defaultNodeInspectorUrl = "http://127.0.0.1:8080/debug";

	constructor(private identifier: string, private adb: string,
		private $logger: ILogger,
		private $fs: IFileSystem,
		private $childProcess: IChildProcess,
		private $errors: IErrors,
		private $staticConfig: Config.IStaticConfig,
		private $opener: IOpener,
		private $devicePlatformsConstants: Mobile.IDevicePlatformsConstants,
		private $options: IOptions,
		private $logcatHelper: Mobile.ILogcatHelper,
		private $hostInfo: IHostInfo) {
		let details: IAndroidDeviceDetails = this.getDeviceDetails().wait();

		this.model = details.model;
		this.name = details.name;
		this.version = details.release;
		this.vendor = details.brand;
	}

	private getDeviceDetails(): IFuture<IAndroidDeviceDetails> {
		return (() => {
			let requestDeviceDetailsCommand = this.composeCommand("shell cat /system/build.prop");
			let details: string = this.$childProcess.exec(requestDeviceDetailsCommand).wait();

			let parsedDetails: any = {};
			details.split(/\r?\n|\r/).forEach((value) => {
				//sample line is "ro.build.version.release=4.4"
				let match = /(?:ro\.build\.version|ro\.product)\.(.+)=(.+)/.exec(value);
				if (match) {
					parsedDetails[match[1]] = match[2];
				}
			});

			return parsedDetails;
		}).future<IAndroidDeviceDetails>()();
	}

	public getPlatform(): string {
		return this.$devicePlatformsConstants.Android;
	}

	public getIdentifier(): string {
		return this.identifier;
	}

	public getDisplayName(): string {
		return this.name;
	}

	public getModel(): string {
		return this.model;
	}

	public getVersion(): string {
		return this.version;
	}

	public getVendor(): string {
		return this.vendor;
	}

	public getInstalledApplications(): IFuture<string[]> {
		return (() => {
			if (!this._installedApplications) {
				let listPackagesCommand = this.composeCommand("shell pm list packages");
				let result = this.$childProcess.exec(listPackagesCommand).wait();
				this._installedApplications = _.map(result.split(os.EOL), (packageString: string) => {
					let match = packageString.match(/package:(.+)/);
					return match ? match[1] : null;
				}).filter(parsedPackage => parsedPackage != null);
			}

			return this._installedApplications;
		}).future<string[]>()();
	}

	public sendBroadcastToDevice(action: string, extras: IStringDictionary = {}): IFuture<number> {
		return (() => {
			let broadcastCommand = this.composeCommand("shell am broadcast -a \"%s\"", action);

			_.each(extras, (value,key) => broadcastCommand += util.format(" -e \"%s\" \"%s\"", key, value) );

			let result = this.$childProcess.exec(broadcastCommand).wait();
			let match = result.match(/Broadcast completed: result=(\d+)/);
			if (match) {
				return +match[1];
			}

			this.$errors.fail("Unable to broadcast to android device:\n%s", result);
		}).future<number>()();
	}

	private getLiveSyncRoot(appIdentifier: Mobile.IAppIdentifier, liveSyncVersion: number): string {
		if(!this._tmpRoots[appIdentifier.appIdentifier]) {
			if (liveSyncVersion === 2) {
				this._tmpRoots[appIdentifier.appIdentifier] = util.format(AndroidDevice.DEVICE_TMP_DIR_FORMAT_V2, appIdentifier.appIdentifier);
			} else if (liveSyncVersion === 3) {
				this._tmpRoots[appIdentifier.appIdentifier] = util.format(AndroidDevice.DEVICE_TMP_DIR_FORMAT_V3, appIdentifier.appIdentifier);
			} else {
				this.$errors.fail("Unsupported LiveSync version: %d", liveSyncVersion);
			}
		}

		return this._tmpRoots[appIdentifier.appIdentifier];
	}

	private composeCommand(...args: string[]) {
		let command = util.format.apply(null, args);
		let result = util.format("\"%s\" -s %s", this.adb, this.identifier);
		if (!helpers.isNullOrWhitespace(command)) {
			result += util.format(" %s", command);
		}

		return result;
	}

	private startPackageOnDevice(packageName: string): IFuture<void> {
		return (() => {
			let startPackageCommand = this.composeCommand("shell am start -a android.intent.action.MAIN -n %s/%s -c android.intent.category.LAUNCHER", packageName, this.$staticConfig.START_PACKAGE_ACTIVITY_NAME);
			this.$childProcess.exec(startPackageCommand).wait();

			if (!this.$options.justlaunch) {
				this.openDeviceLogStream();
			}
		}).future<void>()();
	}

	public deploy(packageFile: string, packageName: string): IFuture<void> {
		return (() => {
			let uninstallCommand = this.composeCommand("shell pm uninstall \"%s\"", packageName);
			this.$childProcess.exec(uninstallCommand).wait();

			let installCommand = this.composeCommand("install -r \"%s\"", packageFile);
			this.$childProcess.exec(installCommand).wait();

			this.startPackageOnDevice(packageName).wait();
			this.$logger.info("Successfully deployed on device with identifier '%s'", this.getIdentifier());
		}).future<void>()();
    }

    private tcpForward(src: Number, dest: Number): void {
		let tcpForwardCommand = this.composeCommand("forward tcp:%d tcp:%d", src.toString(), dest.toString());
		this.$childProcess.exec(tcpForwardCommand).wait();
    }

    private startDebuggerClient(port: Number): IFuture<void> {
        return (() => {
            let nodeInspectorModuleFilePath = require.resolve("node-inspector");
            let nodeInspectorModuleDir = path.dirname(nodeInspectorModuleFilePath);
            let nodeInspectorFullPath = path.join(nodeInspectorModuleDir, "bin", "inspector");
            this.$childProcess.spawn(process.argv[0], [nodeInspectorFullPath, "--debug-port", port.toString()], { stdio: "ignore", detached: true });
        }).future<void>()();
    }

    private openDebuggerClient(url: string): void {
		let browser = this.$hostInfo.isDarwin ? "Safari" : "chrome";
		let child = this.$opener.open(url, browser);
		if(!child) {
			this.$errors.fail(`Unable to open ${browser}.`);
		}
		return child;
    }

    private printDebugPort(packageName: string): void {
        let res = this.$childProcess.spawnFromEvent(this.adb, ["shell", "am", "broadcast", "-a", packageName + "-GetDgbPort"], "exit").wait();
        this.$logger.info(res.stdout);
    }

    private attachDebugger(packageName: string): void {
        let startDebuggerCommand = this.composeCommand("shell am broadcast -a \"%s-Debug\" --ez enable true", packageName);
        let port = this.$options.debugPort;
		
        if (port > 0) {
            startDebuggerCommand += " --ei debuggerPort " + port;
            this.$childProcess.exec(startDebuggerCommand).wait();
        } else {
            let res = this.$childProcess.spawnFromEvent(this.adb, ["shell", "am", "broadcast", "-a", packageName + "-Debug", "--ez", "enable", "true"], "exit").wait();
            let match = res.stdout.match(/result=(\d)+/);
            if (match) {
                port = match[0].substring(7);
            } else {
                port = 0;
            }
        }
        if ((0 < port) && (port < 65536)) {
            this.tcpForward(port, port);
            this.startDebuggerClient(port).wait();
            this.openDebuggerClient(this.defaultNodeInspectorUrl + "?port=" + port);
        } else {
          this.$logger.info("Cannot detect debug port.");
        }
    }

    private detachDebugger(packageName: string): void {
        let stopDebuggerCommand = this.composeCommand("shell am broadcast -a \"%s-Debug\" --ez enable false", packageName);
        this.$childProcess.exec(stopDebuggerCommand).wait();
    }

    private startAppWithDebugger(packageFile: string, packageName: string): void {
        let uninstallCommand = this.composeCommand("shell pm uninstall \"%s\"", packageName);
		this.$childProcess.exec(uninstallCommand).wait();

        let installCommand = this.composeCommand("install -r \"%s\"", packageFile);
        this.$childProcess.exec(installCommand).wait();

        let port = this.$options.debugPort;

        let envDebugOutFullpath = "files/" + AndroidDevice.ENV_DEBUG_OUT_FILENAME;

        let clearDebugEnvironmentCommand = this.composeCommand('shell run-as "%s" rm "%s"', packageName,  envDebugOutFullpath);
        this.$childProcess.exec(clearDebugEnvironmentCommand).wait();

		let debugBreakPath = "files/debugbreak";

		let setDebugBreakEnvironmentCommand = this.composeCommand('shell run-as "%s" touch "%s"', packageName, debugBreakPath);
		this.$childProcess.exec(setDebugBreakEnvironmentCommand).wait();
		
        this.startPackageOnDevice(packageName).wait();

        let dbgPort = this.startAndGetPort(packageName).wait();
        if (dbgPort > 0) {
            this.tcpForward(dbgPort, dbgPort);
            this.startDebuggerClient(dbgPort).wait();
            this.openDebuggerClient(this.defaultNodeInspectorUrl + "?port=" + dbgPort);
        }
    }

    public debug(packageFile: string, packageName: string): IFuture<void> {
        return (() => {
            if (this.$options.getPort) {
                this.printDebugPort(packageName);
            } else if (this.$options.start) {
                this.attachDebugger(packageName);
            } else if (this.$options.stop) {
                this.detachDebugger(packageName);
            } else if (this.$options.debugBrk) {
                this.startAppWithDebugger(packageFile, packageName);
            } else {
                this.$logger.info("Should specify at least one option: debug-brk, start, stop, get-port.");
            }
        }).future<void>()();
    }

    private checkIsRunning(packageName: string): boolean {
        let envDebugOutFullpath = "files/" + AndroidDevice.ENV_DEBUG_OUT_FILENAME;
        let isRunning = this.checkIfFileExists(envDebugOutFullpath, packageName).wait();
        return isRunning;
    }

    private checkIfFileExists(filename: string, packageName: string): IFuture<boolean> {
        return (() => {
            let args = ["shell", "run-as", packageName, "test", "-f", filename, "&&", "echo 'yes'", "||", "echo 'no'"];
            let res = this.$childProcess.spawnFromEvent(this.adb, args, "exit").wait();
            let exists = res.stdout.indexOf('yes') > -1;
            return exists;
        }).future<boolean>()();
    }

    private startAndGetPort(packageName: string): IFuture<number> {
        return (() => {
            let port = -1;
			let timeout = 60;

            let envDebugInFullpath = "files/" + AndroidDevice.ENV_DEBUG_IN_FILENAME;

            let clearDebugEnvironmentCommand = this.composeCommand('shell run-as "%s" rm "%s"', packageName, envDebugInFullpath);
            this.$childProcess.exec(clearDebugEnvironmentCommand).wait();

            let isRunning = false;
            for (let i = 0; i < timeout; i++) {
                helpers.sleep(1000 /* ms */);
                isRunning = this.checkIsRunning(packageName);
                if (isRunning)
                    break;
            }
			
            if (isRunning) {
                let setEnvironmentCommand = this.composeCommand('shell run-as "%s" touch "%s"', packageName, envDebugInFullpath);
                this.$childProcess.exec(setEnvironmentCommand).wait();

                for (let i = 0; i < timeout; i++) {
                    helpers.sleep(1000 /* ms */);
                    let envDebugOutFullpath = "files/" + AndroidDevice.ENV_DEBUG_OUT_FILENAME;

                    let exists = this.checkIfFileExists(envDebugOutFullpath, packageName).wait();
                    if (exists) {
                        let res = this.$childProcess.spawnFromEvent(this.adb, ["shell", "run-as", packageName, "cat", envDebugOutFullpath], "exit").wait();
                        let match = res.stdout.match(/PORT=(\d)+/);
                        if (match) {
                            port = parseInt(match[0].substring(5), 10);
                            break;
                        }
                    }
                }
            }
            return port;
        }).future<number>()();
    }

    private ensureFullAccessPermissions(devicePath: string): IFuture<void> {
		let command = this.composeCommand('shell chmod 0777 "%s"', devicePath);
		return this.$childProcess.exec(command);
	}

	private pushFileOnDevice(localPath: string, devicePath: string): IFuture<void> {
		return (() => {
			let rmCommand = this.composeCommand('shell rm -r "%s"', devicePath);
			this.$childProcess.exec(rmCommand).wait();

			if (this.$fs.exists(localPath).wait()) {
				let isDirectory = this.$fs.getFsStats(localPath).wait().isDirectory();

				let mkdirCommand = this.composeCommand('shell mkdir -p "%s"', isDirectory ? devicePath : path.dirname(devicePath));
				this.$childProcess.exec(mkdirCommand).wait();

				this.pushFileOnDeviceCore(localPath, devicePath).wait();
			}
		}).future<void>()();
	}

	private pushFileOnDeviceCore(localPath: string, devicePath: string): IFuture<void> {
		return (() => {
			let isDirectory = this.$fs.getFsStats(localPath).wait().isDirectory();
			let pushFileCommand = this.composeCommand('push "%s" "%s"', isDirectory ? path.join(localPath, ".") : localPath, devicePath);
			this.$childProcess.exec(pushFileCommand).wait();
		}).future<void>()();
	}

	public sync(localToDevicePaths: Mobile.ILocalToDevicePathData[], appIdentifier: Mobile.IAppIdentifier, liveSyncUrl: string, syncOptions: Mobile.ISyncOptions = {}): IFuture<void> {
		return (() => {
			if (appIdentifier.isLiveSyncSupported(this).wait()) {
				let liveSyncVersion = this.getLiveSyncVersion(appIdentifier).wait();
				if(liveSyncVersion >= 2) {
					this.syncNewProtocol(localToDevicePaths, appIdentifier, liveSyncUrl, liveSyncVersion, syncOptions).wait();
				} else {
					this.syncOldProtocol(localToDevicePaths, appIdentifier, liveSyncUrl, syncOptions).wait();
				}
				this.$logger.info("Successfully synced device with identifier '%s'", this.getIdentifier());
			} else {
				this.$errors.fail({formatStr: appIdentifier.getLiveSyncNotSupportedError(this), suppressCommandHelp: true });
			}
		}).future<void>()();
	}


	public runApplication(applicationId: string): IFuture<void> {
		return this.startPackageOnDevice(applicationId);
	}

	public listApplications(): void { }

	public uninstallApplication(applicationId: string): IFuture<void> {
		return (() => { }).future<void>()();
	}

	public listFiles(devicePath: string): IFuture<void> {
		return (() => { }).future<void>()();
	}

	public getFile(deviceFilePath: string): IFuture<void> {
		return (() => { }).future<void>()();
	}

	public putFile(localFilePath: string, deviceFilePath: string): IFuture<void> {
		return (() => { }).future<void>()();
	}

	private getLiveSyncVersion(appIdentifier: Mobile.IAppIdentifier): IFuture<number> {
		return this.sendBroadcastToDevice(AndroidDevice.CHECK_LIVESYNC_INTENT_NAME, {"app-id": appIdentifier.appIdentifier});
	}

	private createLiveSyncCommandsFileOnDevice(liveSyncRoot: string, commands: string[]): IFuture<void> {
		return (() => {
			let hostTmpDir = this.getTempDir();
			let commandsFileHostPath = path.join(hostTmpDir, AndroidDevice.COMMANDS_FILE);
			let commandsFile = <NodeJS.WritableStream>this.$fs.createWriteStream(commandsFileHostPath);
			let fileWritten = this.$fs.futureFromEvent(commandsFile, 'finish');

			_.each(commands, command => {
				commandsFile.write(command);
			});

			commandsFile.end();
			fileWritten.wait();

			// copy it to the device
			let commandsFileDevicePath = this.buildDevicePath(liveSyncRoot, AndroidDevice.COMMANDS_FILE);
			this.pushFileOnDeviceCore(commandsFileHostPath, commandsFileDevicePath).wait();
			this.ensureFullAccessPermissions(commandsFileDevicePath).wait();
		}).future<void>()();
	}

	private getTempDir(): string {
		temp.track();
		return temp.mkdirSync("ab-");
	}

	private syncOldProtocol(localToDevicePaths: Mobile.ILocalToDevicePathData[], appIdentifier: Mobile.IAppIdentifier, liveSyncUrl: string, syncOptions: Mobile.ISyncOptions = {}): IFuture<void> {
		return (() => {
			_.each(localToDevicePaths, localToDevicePathData => {
				this.pushFileOnDevice(localToDevicePathData.getLocalPath(), localToDevicePathData.getDevicePath()).wait();
			});
			if (!syncOptions.skipRefresh) {
				let changeLiveSyncUrlExtras: IStringDictionary = {
					"liveSyncUrl": liveSyncUrl,
					"app-id": appIdentifier.appIdentifier
				};
				this.sendBroadcastToDevice(AndroidDevice.CHANGE_LIVESYNC_URL_INTENT_NAME, changeLiveSyncUrlExtras).wait();
				this.sendBroadcastToDevice(AndroidDevice.REFRESH_WEB_VIEW_INTENT_NAME, { "app-id": appIdentifier.appIdentifier }).wait();
			}
		}).future<void>()();
	}

	private syncNewProtocol(localToDevicePaths: Mobile.ILocalToDevicePathData[], appIdentifier: Mobile.IAppIdentifier, liveSyncUrl: string, liveSyncVersion: number, syncOptions: Mobile.ISyncOptions = {}): IFuture<void> {
		return (() => {
			let liveSyncRoot = this.getLiveSyncRoot(appIdentifier, liveSyncVersion);
			let dirs:IStringDictionary = Object.create(null);

			_.each(localToDevicePaths, (localToDevicePathData: Mobile.ILocalToDevicePathData) => {
				let relativeToProjectBasePath = helpers.fromWindowsRelativePathToUnix(localToDevicePathData.getRelativeToProjectBasePath());
				let devicePath = this.buildDevicePath(liveSyncRoot, relativeToProjectBasePath);

				this.pushFileOnDevice(localToDevicePathData.getLocalPath(), devicePath).wait();

				if (liveSyncVersion === 2) {
					let parts = relativeToProjectBasePath.split(AndroidDevice.DEVICE_PATH_SEPARATOR);
					let currentPath = "";
					_.each(parts, p => {
						if(p !== "") {
							currentPath = this.buildDevicePath(currentPath, p);
							if(!dirs[currentPath]) {
								dirs[currentPath] = currentPath;
								this.ensureFullAccessPermissions(this.buildDevicePath(liveSyncRoot, currentPath)).wait();
							}
						}
					});
				}
			});

			this.ensureFullAccessPermissions(liveSyncRoot).wait();

			if (!syncOptions.skipRefresh) {
				let commands: string[] = [];

				if(this.$options.watch || this.$options.file) {
					commands = [
						LiveSyncCommands.SyncFilesCommand(),
						LiveSyncCommands.RefreshCurrentViewCommand()
					];
				} else {
					commands = [
						LiveSyncCommands.DeployProjectCommand(liveSyncUrl),
						LiveSyncCommands.ReloadStartViewCommand()
					];
				}
				this.createLiveSyncCommandsFileOnDevice(liveSyncRoot, commands).wait();
				this.sendBroadcastToDevice(AndroidDevice.LIVESYNC_BROADCAST_NAME, { "app-id": appIdentifier.appIdentifier }).wait();
			}
		}).future<void>()();
	}

	private buildDevicePath(...args: string[]): string {
		return args.join(AndroidDevice.DEVICE_PATH_SEPARATOR);
	}

	public openDeviceLogStream(): void {
		this.$logcatHelper.start(this.getIdentifier(), this.adb);
	}
}
