///<reference path="../../../.d.ts"/>
"use strict";
import MobileHelper = require("./../mobile-helper");
import util = require("util");
import Future = require("fibers/future");
import path = require("path");
import temp = require("temp");
import byline = require("byline");
import helpers = require("../../helpers");
import os = require("os");
import hostInfo = require("../../host-info");
import options = require("./../../options");

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

export class AndroidDevice implements Mobile.IDevice {
	private static REFRESH_WEB_VIEW_INTENT_NAME = "com.telerik.RefreshWebView";
	private static CHANGE_LIVESYNC_URL_INTENT_NAME = "com.telerik.ChangeLiveSyncUrl";
	private static LIVESYNC_BROADCAST_NAME = "com.telerik.LiveSync";
	private static CHECK_LIVESYNC_INTENT_NAME = "com.telerik.IsLiveSyncSupported"

	private static DEVICE_TMP_DIR = "/data/local/tmp";
	private static SYNC_ROOT = "12590FAA-5EDD-4B12-856D-F52A0A1599F2";
	private static COMMANDS_FILE = "telerik.livesync.commands";
	private static DEVICE_PATH_SEPARATOR = "/";

	private model: string;
	private name: string;
	private version: string;
	private vendor: string;
	private tmpRoot: string;
	private _tmpRoots: IStringDictionary = {};
	private _installedApplications: string[];

	constructor(private identifier: string, private adb: string,
		private $logger: ILogger,
		private $fs: IFileSystem,
		private $childProcess: IChildProcess,
		private $errors: IErrors,
		private $staticConfig: IStaticConfig) {
		var details: IAndroidDeviceDetails = this.getDeviceDetails().wait();
		this.model = details.model;
		this.name = details.name;
		this.version = details.release;
		this.vendor = details.brand;
		this.tmpRoot = this.buildDevicePath(AndroidDevice.DEVICE_TMP_DIR, AndroidDevice.SYNC_ROOT);
	}

	private getDeviceDetails(): IFuture<IAndroidDeviceDetails> {
		return (() => {
			var requestDeviceDetailsCommand = this.composeCommand("shell cat /system/build.prop");
			var details: string = this.$childProcess.exec(requestDeviceDetailsCommand).wait();

			var parsedDetails: any = {};
			details.split(/\r?\n|\r/).forEach((value) => {
				//sample line is "ro.build.version.release=4.4"
				var match = /(?:ro\.build\.version|ro\.product)\.(.+)=(.+)/.exec(value)
				if (match) {
					parsedDetails[match[1]] = match[2];
				}
			});

			return parsedDetails;
		}).future<IAndroidDeviceDetails>()();
	}

	public getPlatform(): string {
		return MobileHelper.DevicePlatforms[MobileHelper.DevicePlatforms.Android];
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
				var listPackagesCommand = this.composeCommand("shell pm list packages")
				var result = this.$childProcess.exec(listPackagesCommand).wait();
				this._installedApplications = _.map(result.split(os.EOL), (packageString: string) => {
					var match = packageString.match(/package:(.+)/);
					return match ? match[1] : null;
				}).filter(parsedPackage => parsedPackage != null);
			}

			return this._installedApplications
		}).future<string[]>()();
	}

	public sendBroadcastToDevice(action: string, extras: IStringDictionary = {}): IFuture<number> {
		return (() => {
			var broadcastCommand = this.composeCommand("shell am broadcast -a \"%s\"", action);

			_.each(Object.keys(extras), key  => {
				broadcastCommand += util.format(" -e \"%s\" \"%s\"", key, extras[key]);
			});

			var result = this.$childProcess.exec(broadcastCommand).wait();
			var match = result.match(/Broadcast completed: result=(\d+)/);
			if (match) {
				return +match[1];
			}

			this.$errors.fail("Unable to broadcast to android device:\n%s", result);
		}).future<number>()();
	}

	private getLiveSyncRoot(appIdentifier: Mobile.IAppIdentifier): string {
		if(!this._tmpRoots[appIdentifier.appIdentifier]) {
			this._tmpRoots[appIdentifier.appIdentifier] = this.buildDevicePath(this.tmpRoot, appIdentifier.appIdentifier);
		}

		return this._tmpRoots[appIdentifier.appIdentifier];
	}

	private composeCommand(...args: string[]) {
		var command = util.format.apply(null, args);
		var result = util.format("\"%s\" -s %s", this.adb, this.identifier);
		if (command && !command.isEmpty()) {
			result += util.format(" %s", command);
		}

		return result;
	}

	private startPackageOnDevice(packageName: string): IFuture<void> {
		return (() => {
			var startPackageCommand = this.composeCommand("shell am start -a android.intent.action.MAIN -n %s/%s", packageName, this.$staticConfig.START_PACKAGE_ACTIVITY_NAME);
			var result = this.$childProcess.exec(startPackageCommand).wait();
			return result[0];
		}).future<void>()();
	}

	public deploy(packageFile: string, packageName: string): IFuture<void> {
		return (() => {
			var uninstallCommand = this.composeCommand("shell pm uninstall \"%s\"", packageName)
			this.$childProcess.exec(uninstallCommand).wait();

			var installCommand = this.composeCommand("install -r \"%s\"", packageFile);
			this.$childProcess.exec(installCommand).wait();

			this.startPackageOnDevice(packageName).wait();
			this.$logger.info("Successfully deployed on device with identifier '%s'", this.getIdentifier());
		}).future<void>()();
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

	private getLiveSyncUrl(projectType: number): string {
		var projectTypes = $injector.resolve("$projectTypes");
		switch (projectType) {
			case projectTypes.Cordova:
				return "icenium://";
			case projectTypes.NativeScript:
				return "nativescript://";
			default:
				this.$errors.fail("Unsupported project type");
		}
	}

	public sync(localToDevicePaths: Mobile.ILocalToDevicePathData[], appIdentifier: Mobile.IAppIdentifier, projectType: number, syncOptions: Mobile.ISyncOptions = {}): IFuture<void> {
		return (() => {
			if (appIdentifier.isLiveSyncSupported(this).wait()) {
				if(this.isLiveSyncVersion2(appIdentifier).wait()) {
					this.syncNewProtocol(localToDevicePaths, appIdentifier, projectType, syncOptions).wait();
				} else {
					this.syncOldProtocol(localToDevicePaths, appIdentifier, projectType, syncOptions).wait();
				}
				this.$logger.info("Successfully synced device with identifier '%s'", this.getIdentifier());
			} else {
				this.$errors.fail({formatStr: appIdentifier.getLiveSyncNotSupportedError(this), suppressCommandHelp: true });
			}
		}).future<void>()();
	}

	private isLiveSyncVersion2(appIdentifier: Mobile.IAppIdentifier): IFuture<boolean> {
		return (() => {
			var result = this.sendBroadcastToDevice(AndroidDevice.CHECK_LIVESYNC_INTENT_NAME, {"app-id": appIdentifier.appIdentifier}).wait();
			return result >= 2;
		}).future<boolean>()();
	}

	private createLiveSyncCommandsFileOnDevice(appIdentifier: Mobile.IAppIdentifier, commands: string[]): IFuture<void> {
		return (() => {
			var hostTmpDir = this.getTempDir();
			var commandsFileHostPath = path.join(hostTmpDir, AndroidDevice.COMMANDS_FILE);
			var commandsFile = <WritableStream>this.$fs.createWriteStream(commandsFileHostPath);
			var fileWritten = this.$fs.futureFromEvent(commandsFile, 'finish');

			_.each(commands, command => {
				commandsFile.write(command);
			});

			commandsFile.end();
			fileWritten.wait();

			// copy it to the device
			var commandsFileDevicePath = this.buildDevicePath(this.getLiveSyncRoot(appIdentifier), AndroidDevice.COMMANDS_FILE);
			this.pushFileOnDeviceCore(commandsFileHostPath, commandsFileDevicePath).wait();
			this.ensureFullAccessPermissions(commandsFileDevicePath).wait();
		}).future<void>()();
	}

	private getTempDir(): string {
		temp.track();
		return temp.mkdirSync("ab-");
	}

	private syncOldProtocol(localToDevicePaths: Mobile.ILocalToDevicePathData[], appIdentifier: Mobile.IAppIdentifier, projectType: number, syncOptions: Mobile.ISyncOptions = {}): IFuture<void> {
		return (() => {
			_.each(localToDevicePaths, localToDevicePathData => {
				this.pushFileOnDevice(localToDevicePathData.getLocalPath(), localToDevicePathData.getDevicePath()).wait();
			});
			if (!syncOptions.skipRefresh) {
				var changeLiveSyncUrlExtras: IStringDictionary = {
					"liveSyncUrl": this.getLiveSyncUrl(projectType),
					"app-id": appIdentifier.appIdentifier
				};
				this.sendBroadcastToDevice(AndroidDevice.CHANGE_LIVESYNC_URL_INTENT_NAME, changeLiveSyncUrlExtras).wait();
				this.sendBroadcastToDevice(AndroidDevice.REFRESH_WEB_VIEW_INTENT_NAME, { "app-id": appIdentifier.appIdentifier }).wait();
			}
		}).future<void>()();
	}

	private syncNewProtocol(localToDevicePaths: Mobile.ILocalToDevicePathData[], appIdentifier: Mobile.IAppIdentifier, projectType: number, syncOptions: Mobile.ISyncOptions = {}): IFuture<void> {
		return (() => {
			var liveSyncRoot = this.getLiveSyncRoot(appIdentifier);
			var dirs = {};

			_.each(localToDevicePaths, (localToDevicePathData: Mobile.ILocalToDevicePathData) => {
				var relativeToProjectBasePath = helpers.fromWindowsRelativePathToUnix(localToDevicePathData.getRelativeToProjectBasePath());
				var devicePath = this.buildDevicePath(liveSyncRoot, relativeToProjectBasePath);
				var parts = relativeToProjectBasePath.split(AndroidDevice.DEVICE_PATH_SEPARATOR);
				var currentPath = "";

				this.pushFileOnDevice(localToDevicePathData.getLocalPath(), devicePath).wait();

				_.each(parts, p => {
					if(p !== "") {
						currentPath = this.buildDevicePath(currentPath, p);
						if(!dirs[currentPath]) {
							dirs[currentPath] = currentPath;
							this.ensureFullAccessPermissions(this.buildDevicePath(liveSyncRoot, currentPath)).wait();
						}
					}
				});
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
						LiveSyncCommands.DeployProjectCommand(this.getLiveSyncUrl(projectType)),
						LiveSyncCommands.ReloadStartViewCommand()
					];
				}
				this.createLiveSyncCommandsFileOnDevice(appIdentifier, commands).wait();
				this.sendBroadcastToDevice(AndroidDevice.LIVESYNC_BROADCAST_NAME, { "app-id": appIdentifier.appIdentifier }).wait();
			}
		}).future<void>()();
	}

	private buildDevicePath(...args: string[]): string {
		return args.join(AndroidDevice.DEVICE_PATH_SEPARATOR);
	}

	openDeviceLogStream() {
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
