///<reference path="../../.d.ts"/>
"use strict";

import helpers = require("../../helpers");
import * as path from "path";
import * as temp from "temp";

class LiveSyncCommands {
	public static DeployProjectCommand(liveSyncUrl: string): string {
		return `DeployProject ${liveSyncUrl} \r`;
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

export class AndroidLiveSyncService implements Mobile.IAndroidLiveSyncService {
	private static COMMANDS_FILE = "telerik.livesync.commands";
	private static LIVESYNC_BROADCAST_NAME = "com.telerik.LiveSync";

	constructor(protected device: Mobile.IAndroidDevice,
		protected $fs: IFileSystem,
		protected $mobileHelper: Mobile.IMobileHelper) { }

	public get liveSyncCommands(): any {
		return LiveSyncCommands;
	}

	public livesync(appIdentifier: string, liveSyncRoot: string, commands: string[]): IFuture<void> {
		return (() => {
			let commandsFileDevicePath = this.$mobileHelper.buildDevicePath(liveSyncRoot, AndroidLiveSyncService.COMMANDS_FILE);
			this.createCommandsFileOnDevice(commandsFileDevicePath, commands).wait();
			this.device.adb.sendBroadcastToDevice(AndroidLiveSyncService.LIVESYNC_BROADCAST_NAME, { "app-id": appIdentifier }).wait();
		}).future<void>()();
	}

	public createCommandsFileOnDevice(commandsFileDevicePath: string, commands: string[]): IFuture<void> {
		return (() => {
			let hostTmpDir = this.getTempDir();
			let commandsFileHostPath = path.join(hostTmpDir, AndroidLiveSyncService.COMMANDS_FILE);
			this.$fs.writeFile(commandsFileHostPath, commands.join("\n")).wait();

			// copy it to the device
			this.device.fileSystem.transferFile(commandsFileHostPath, commandsFileDevicePath).wait();
			this.device.adb.executeShellCommand(["chmod", "0777", `${commandsFileDevicePath}`]).wait();
		}).future<void>()();
	}

	private getTempDir(): string {
		temp.track();
		return temp.mkdirSync("ab-");
	}
}
