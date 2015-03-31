///<reference path="../../../.d.ts"/>
"use strict";
import util = require("util");
import Future = require("fibers/future");
import path = require("path");
import temp = require("temp");
import byline = require("byline");
import helpers = require("../../helpers");
import os = require("os");
import options = require("./../../options");
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
	private static CHECK_LIVESYNC_INTENT_NAME = "com.telerik.IsLiveSyncSupported"

	private static ENV_DEBUG_IN_FILENAME = "envDebug.in";
	private static ENV_DEBUG_OUT_FILENAME = "envDebug.out";
	private static PACKAGE_EXTERNAL_DIR_TEMPLATE = "/sdcard/Android/data/%s/files/";
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
		private $devicePlatformsConstants: Mobile.IDevicePlatformsConstants) {
		var details: IAndroidDeviceDetails = this.getDeviceDetails().wait();
		this.model = details.model;
		this.name = details.name;
		this.version = details.release;
		this.vendor = details.brand;
	}

	private getDeviceDetails(): IFuture<IAndroidDeviceDetails> {
		return (() => {
			var requestDeviceDetailsCommand = this.composeCommand("shell cat /system/build.prop");
			var details: string = this.$childProcess.exec(requestDeviceDetailsCommand).wait();

			var parsedDetails: any = {};
			details.split(/\r?\n|\r/).forEach((value) => {
				//sample line is "ro.build.version.release=4.4"
				var match = /(?:ro\.build\.version|ro\.product)\.(.+)=(.+)/.exec(value);
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
				var listPackagesCommand = this.composeCommand("shell pm list packages");
				var result = this.$childProcess.exec(listPackagesCommand).wait();
				this._installedApplications = _.map(result.split(os.EOL), (packageString: string) => {
					var match = packageString.match(/package:(.+)/);
					return match ? match[1] : null;
				}).filter(parsedPackage => parsedPackage != null);
			}

			return this._installedApplications;
		}).future<string[]>()();
	}

	public sendBroadcastToDevice(action: string, extras: IStringDictionary = {}): IFuture<number> {
		return (() => {
			var broadcastCommand = this.composeCommand("shell am broadcast -a \"%s\"", action);

			_.each(extras, (value,key) => broadcastCommand += util.format(" -e \"%s\" \"%s\"", key, value) );

			var result = this.$childProcess.exec(broadcastCommand).wait();
			var match = result.match(/Broadcast completed: result=(\d+)/);
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
		var command = util.format.apply(null, args);
		var result = util.format("\"%s\" -s %s", this.adb, this.identifier);
		if (!helpers.isNullOrWhitespace(command)) {
			result += util.format(" %s", command);
		}

		return result;
	}

	private startPackageOnDevice(packageName: string): IFuture<void> {
		return (() => {
			var startPackageCommand = this.composeCommand("shell am start -a android.intent.action.MAIN -n %s/%s", packageName, this.$staticConfig.START_PACKAGE_ACTIVITY_NAME);
			this.$childProcess.exec(startPackageCommand).wait();

			if (options.printAppOutput) {
				this.openDeviceLogStream();
			}
		}).future<void>()();
	}

	public deploy(packageFile: string, packageName: string): IFuture<void> {
		return (() => {
			var uninstallCommand = this.composeCommand("shell pm uninstall \"%s\"", packageName);
			this.$childProcess.exec(uninstallCommand).wait();

			var installCommand = this.composeCommand("install -r \"%s\"", packageFile);
			this.$childProcess.exec(installCommand).wait();

			this.startPackageOnDevice(packageName).wait();
			this.$logger.info("Successfully deployed on device with identifier '%s'", this.getIdentifier());
		}).future<void>()();
    }

    private tcpForward(src: Number, dest: Number): void {
		var tcpForwardCommand = this.composeCommand("forward tcp:%d tcp:%d", src.toString(), dest.toString());
		this.$childProcess.exec(tcpForwardCommand).wait();
    }

    private startDebuggerClient(port: Number): IFuture<void> {
        return (() => {
            var nodeInspectorModuleFilePath = require.resolve("node-inspector");
            var nodeInspectorModuleDir = path.dirname(nodeInspectorModuleFilePath);
            var nodeInspectorFullPath = path.join(nodeInspectorModuleDir, "bin", "inspector");
            this.$childProcess.spawn(process.argv[0], [nodeInspectorFullPath, "--debug-port", port.toString()], { stdio: "ignore", detached: true });
        }).future<void>()();
    }

    private openDebuggerClient(url: string): void {
		this.$opener.open(url, "chrome");
    }

    private printDebugPort(packageName: string): void {
        var res = this.$childProcess.spawnFromEvent(this.adb, ["shell", "am", "broadcast", "-a", packageName + "-GetDgbPort"], "exit").wait();
        this.$logger.info(res.stdout);
    }

    private attachDebugger(packageName: string): void {
        var startDebuggerCommand = this.composeCommand("shell am broadcast -a \"%s-Debug\" --ez enable true", packageName);
        var port = options.debugPort;
        if (port > 0) {
            startDebuggerCommand += " --ei debuggerPort " + options["debug-port"];
            this.$childProcess.exec(startDebuggerCommand).wait();
        } else {
            var res = this.$childProcess.spawnFromEvent(this.adb, ["shell", "am", "broadcast", "-a", packageName + "-Debug", "--ez", "enable", "true"], "exit").wait();
            var match = res.stdout.match(/result=(\d)+/);
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
        var stopDebuggerCommand = this.composeCommand("shell am broadcast -a \"%s-Debug\" --ez enable false", packageName);
        this.$childProcess.exec(stopDebuggerCommand).wait();
    }

    private startAppWithDebugger(packageFile: string, packageName: string): void {
        var uninstallCommand = this.composeCommand("shell pm uninstall \"%s\"", packageName);
		this.$childProcess.exec(uninstallCommand).wait();

        var installCommand = this.composeCommand("install -r \"%s\"", packageFile);
        this.$childProcess.exec(installCommand).wait();

        var port = options["debug-port"];

        var packageDir = util.format(AndroidDevice.PACKAGE_EXTERNAL_DIR_TEMPLATE, packageName);
        var envDebugOutFullpath = packageDir + AndroidDevice.ENV_DEBUG_OUT_FILENAME;
        var clearDebugEnvironmentCommand = this.composeCommand('shell rm "%s"', envDebugOutFullpath);
        this.$childProcess.exec(clearDebugEnvironmentCommand).wait();

        this.startPackageOnDevice(packageName).wait();

        var dbgPort = this.startAndGetPort(packageName).wait();

        if (dbgPort > 0) {
            this.tcpForward(dbgPort, dbgPort);
            this.startDebuggerClient(dbgPort).wait();
            this.openDebuggerClient(this.defaultNodeInspectorUrl + "?port=" + dbgPort);
        }
    }

    public debug(packageFile: string, packageName: string): IFuture<void> {
        return (() => {
            if (options["get-port"]) {
                this.printDebugPort(packageName);
            } else if (options["start"]) {
                this.attachDebugger(packageName);
            } else if (options["stop"]) {
                this.detachDebugger(packageName);
            } else if (options["debug-brk"]) {
                this.startAppWithDebugger(packageFile, packageName);
            } else {
                this.$logger.info("Should specify at least one option: debug-brk, start, stop, get-port.");
            }
        }).future<void>()();
    }

    private checkIfRunning(packageName: string): boolean {
        var packageDir = util.format(AndroidDevice.PACKAGE_EXTERNAL_DIR_TEMPLATE, packageName);
        var envDebugOutFullpath = packageDir + AndroidDevice.ENV_DEBUG_OUT_FILENAME;
        var isRunning = this.checkIfFileExists(envDebugOutFullpath).wait();
        return isRunning;
    }

    private checkIfFileExists(filename: string): IFuture<boolean> {
        return (() => {
            var args = ["shell", "test", "-f", filename, "&&", "echo 'yes'", "||", "echo 'no'"];
            var res = this.$childProcess.spawnFromEvent(this.adb, args, "exit").wait();
            var exists = res.stdout.indexOf('yes') > -1;
            return exists;
        }).future<boolean>()();
    }

    private startAndGetPort(packageName: string): IFuture<number> {
        return (() => {
            var port = -1;

            var packageDir = util.format(AndroidDevice.PACKAGE_EXTERNAL_DIR_TEMPLATE, packageName);
            var envDebugInFullpath = packageDir + AndroidDevice.ENV_DEBUG_IN_FILENAME;
            var clearDebugEnvironmentCommand = this.composeCommand('shell rm "%s"', envDebugInFullpath);
            this.$childProcess.exec(clearDebugEnvironmentCommand).wait();

            var isRunning = false;
            for (var i = 0; i < 60; i++) {
                helpers.sleep(1000 /* ms */);
                isRunning = this.checkIfRunning(packageName);
                if (isRunning)
                    break;
            }

            if (isRunning) {
                var setEnvironmentCommand = this.composeCommand('shell "cat /dev/null > %s"', envDebugInFullpath);
                this.$childProcess.exec(setEnvironmentCommand).wait();

                for (var i = 0; i < 10; i++) {
                    helpers.sleep(1000 /* ms */);
                    var envDebugOutFullpath = packageDir + AndroidDevice.ENV_DEBUG_OUT_FILENAME;
                    var exists = this.checkIfFileExists(envDebugOutFullpath).wait();
                    if (exists) {
                        var res = this.$childProcess.spawnFromEvent(this.adb, ["shell", "cat", envDebugOutFullpath], "exit").wait();
                        var match = res.stdout.match(/PORT=(\d)+/);
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
		var command = this.composeCommand('shell chmod 0777 "%s"', devicePath);
		return this.$childProcess.exec(command);
	}

	private pushFileOnDevice(localPath: string, devicePath: string): IFuture<void> {
		return (() => {
			var rmCommand = this.composeCommand('shell rm -r "%s"', devicePath);
			this.$childProcess.exec(rmCommand).wait();

			if (this.$fs.exists(localPath).wait()) {
				var isDirectory = this.$fs.getFsStats(localPath).wait().isDirectory();

				var mkdirCommand = this.composeCommand('shell mkdir -p "%s"', isDirectory ? devicePath : path.dirname(devicePath));
				this.$childProcess.exec(mkdirCommand).wait();

				this.pushFileOnDeviceCore(localPath, devicePath).wait();
			}
		}).future<void>()();
	}

	private pushFileOnDeviceCore(localPath: string, devicePath: string): IFuture<void> {
		return (() => {
			var isDirectory = this.$fs.getFsStats(localPath).wait().isDirectory();
			var pushFileCommand = this.composeCommand('push "%s" "%s"', isDirectory ? path.join(localPath, ".") : localPath, devicePath);
			this.$childProcess.exec(pushFileCommand).wait();
		}).future<void>()();
	}

	public sync(localToDevicePaths: Mobile.ILocalToDevicePathData[], appIdentifier: Mobile.IAppIdentifier, liveSyncUrl: string, syncOptions: Mobile.ISyncOptions = {}): IFuture<void> {
		return (() => {
			if (appIdentifier.isLiveSyncSupported(this).wait()) {
				var liveSyncVersion = this.getLiveSyncVersion(appIdentifier).wait();
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

	private getLiveSyncVersion(appIdentifier: Mobile.IAppIdentifier): IFuture<number> {
		return this.sendBroadcastToDevice(AndroidDevice.CHECK_LIVESYNC_INTENT_NAME, {"app-id": appIdentifier.appIdentifier});
	}

	private createLiveSyncCommandsFileOnDevice(liveSyncRoot: string, commands: string[]): IFuture<void> {
		return (() => {
			var hostTmpDir = this.getTempDir();
			var commandsFileHostPath = path.join(hostTmpDir, AndroidDevice.COMMANDS_FILE);
			var commandsFile = <NodeJS.WritableStream>this.$fs.createWriteStream(commandsFileHostPath);
			var fileWritten = this.$fs.futureFromEvent(commandsFile, 'finish');

			_.each(commands, command => {
				commandsFile.write(command);
			});

			commandsFile.end();
			fileWritten.wait();

			// copy it to the device
			var commandsFileDevicePath = this.buildDevicePath(liveSyncRoot, AndroidDevice.COMMANDS_FILE);
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
				var changeLiveSyncUrlExtras: IStringDictionary = {
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
			var liveSyncRoot = this.getLiveSyncRoot(appIdentifier, liveSyncVersion);
			var dirs:IStringDictionary = Object.create(null);

			_.each(localToDevicePaths, (localToDevicePathData: Mobile.ILocalToDevicePathData) => {
				var relativeToProjectBasePath = helpers.fromWindowsRelativePathToUnix(localToDevicePathData.getRelativeToProjectBasePath());
				var devicePath = this.buildDevicePath(liveSyncRoot, relativeToProjectBasePath);

				this.pushFileOnDevice(localToDevicePathData.getLocalPath(), devicePath).wait();

				if (liveSyncVersion === 2) {
					var parts = relativeToProjectBasePath.split(AndroidDevice.DEVICE_PATH_SEPARATOR);				
					var currentPath = "";
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
				var commands: string[] = [];

				if(options.watch) {
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
		var adbLogcat = this.$childProcess.spawn(this.adb, ["-s", this.getIdentifier(), "logcat"]);
		var lineStream = byline(adbLogcat.stdout);

		adbLogcat.stderr.on("data", (data: NodeBuffer) => {
			this.$logger.trace("ADB logcat stderr: " + data.toString());
		});

		adbLogcat.on("close", (code: number) => {
			if (code !== 0) {
				this.$logger.trace("ADB process exited with code " + code.toString());
			}
		});

		lineStream.on('data', (line: NodeBuffer) => {
			var lineText = line.toString();
			var log = this.getConsoleLogFromLine(lineText);
			if (log) {
				if (log.tag) {
					this.$logger.out("%s: %s", log.tag, log.message);
				} else {
					this.$logger.out(log.message);
				}
			}
		});
	}

	private getConsoleLogFromLine(lineText: String): any {
		var acceptedTags = ["chromium", "Web Console"];

		//sample line is "I/Web Console(    4438): Received Event: deviceready at file:///storage/emulated/0/Icenium/com.telerik.TestApp/js/index.js:48"
		var match = lineText.match(/.\/(.+?)\(\s*(\d+?)\): (.*)/);
		if (match) {
			if (acceptedTags.indexOf(match[1]) !== -1) {
				return { tag: match[1], message: match[3] };
			}
		}
		else if (_.any(acceptedTags, (tag: string) => { return lineText.indexOf(tag) !== -1; })) {
			return { message: match[3] };
		}

		return null;
	}
}
