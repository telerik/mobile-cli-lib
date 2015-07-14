///<reference path="../.d.ts"/>
"use strict";

import path = require("path");
import Future = require("fibers/future");
import helpers = require("../helpers");
import util = require("util");
import querystring = require("querystring");

let ANDROID_PROJECT_PATH = "mnt/sdcard/Icenium/";
let ANDROID_NATIVESCRIPT_PROJECT_PATH = "/data/data/";
let ANDROID_CHECK_LIVE_SYNC_INTENT = "com.telerik.IsLiveSyncSupported";
let ANDROID_ION_APP_IDENTIFIER = "com.telerik.AppBuilder";

let NATIVESCRIPT_ION_APP_IDENTIFIER = "com.telerik.NativeScript";

let IOS_PROJECT_PATH = "/Documents/";
let IOS_ION_APP_IDENTIFIER = "com.telerik.Icenium";

export class AndroidAppIdentifier implements Mobile.IAppIdentifier {
	constructor(private _appIdentifier: string) {}

	get appIdentifier(): string {
		return this._appIdentifier;
	}

	get deviceProjectPath(): string {
		return helpers.fromWindowsRelativePathToUnix(path.join(ANDROID_PROJECT_PATH, this.appIdentifier));
	}

	get liveSyncFormat(): string {
		return "";
	}

	encodeLiveSyncHostUri(hostUri: string): string {
		return hostUri;
	}

	getLiveSyncNotSupportedError(device: Mobile.IDevice): string {
		return util.format("You can't LiveSync on device with id %s! Deploy the app with LiveSync enabled and wait for the initial start up before LiveSyncing.", device.getIdentifier());
	}

	isLiveSyncSupported(device: any): IFuture<boolean> {
		return device.sendBroadcastToDevice(ANDROID_CHECK_LIVE_SYNC_INTENT,
			{ "app-id": this.appIdentifier });
	}
}

export class AndroidCompanionAppIdentifier implements Mobile.IAppIdentifier {
	constructor(private servedApp: string) {}

	get appIdentifier(): string {
		return ANDROID_ION_APP_IDENTIFIER;
	}

	get deviceProjectPath(): string {
		return helpers.fromWindowsRelativePathToUnix(path.join(ANDROID_PROJECT_PATH, this.appIdentifier));
	}

	get liveSyncFormat(): string {
		return "%s/Mist/MobilePackage/redirect?token=%s";
	}

	encodeLiveSyncHostUri(hostUri: string): string {
		return hostUri;
	}

	getLiveSyncNotSupportedError(device: Mobile.IDevice): string {
		return util.format("Cannot LiveSync changes to the companion app. The companion app is not installed on %s.", device.getIdentifier());
	}

	isLiveSyncSupported(device: Mobile.IDevice): IFuture<boolean> {
		return (() => {
			let applications = device.getInstalledApplications().wait();
			return _.contains(applications, this.appIdentifier);
		}).future<boolean>()();
	}
}

export class AndroidNativeScriptCompanionAppIdentifier implements Mobile.IAppIdentifier {
	constructor(private servedApp: string) { }

	get appIdentifier(): string {
		return NATIVESCRIPT_ION_APP_IDENTIFIER;
	}

	get deviceProjectPath(): string {
		return helpers.fromWindowsRelativePathToUnix(path.join(ANDROID_NATIVESCRIPT_PROJECT_PATH, this.appIdentifier, "files"));
	}

	get liveSyncFormat(): string {
		return "%s/Mist/MobilePackage/nsredirect?token=%s";
	}

	encodeLiveSyncHostUri(hostUri: string): string {
		return hostUri;
	}

	getLiveSyncNotSupportedError(device: Mobile.IDevice): string {
		return util.format("Cannot LiveSync changes to the NativeScript companion app. The NativeScript companion app is not installed on %s.", device.getIdentifier());
	}

	isLiveSyncSupported(device: Mobile.IDevice): IFuture<boolean> {
		return (() => {
			let applications = device.getInstalledApplications().wait();
			return _.contains(applications, this.appIdentifier);
		}).future<boolean>()();
	}
}

export class IOSAppIdentifier implements Mobile.IAppIdentifier {
	constructor(private _appIdentifier: string) {}

	get appIdentifier(): string {
		return this._appIdentifier;
	}

	get deviceProjectPath(): string {
		return IOS_PROJECT_PATH;
	}

	get liveSyncFormat(): string {
		return "";
	}

	encodeLiveSyncHostUri(hostUri: string): string {
		return querystring.escape(hostUri);
	}

	getLiveSyncNotSupportedError(device: Mobile.IDevice): string {
		return "";
	}

	isLiveSyncSupported(device: Mobile.IDevice): IFuture<boolean> {
		return Future.fromResult(true);
	}
}

export class IOSCompanionAppIdentifier implements Mobile.IAppIdentifier {
	constructor(private servedApp: string) {}

	get appIdentifier(): string {
		return IOS_ION_APP_IDENTIFIER;
	}

	get deviceProjectPath(): string {
		return IOS_PROJECT_PATH;
	}

	get liveSyncFormat(): string {
		return "icenium://%s?LiveSyncToken=%s";
	}

	encodeLiveSyncHostUri(hostUri: string): string {
		return querystring.escape(hostUri);
	}

	getLiveSyncNotSupportedError(device: Mobile.IDevice): string {
		return "";
	}

	isLiveSyncSupported(device: Mobile.IDevice): IFuture<boolean> {
		return Future.fromResult(true);
	}
}

export class IOSNativeScriptCompanionAppIdentifier implements Mobile.IAppIdentifier {
	constructor(private servedApp: string) { }

	get appIdentifier(): string {
		return NATIVESCRIPT_ION_APP_IDENTIFIER;
	}

	get deviceProjectPath(): string {
		return IOS_PROJECT_PATH;
	}

	get liveSyncFormat(): string {
		return "nativescript://%s?LiveSyncToken=%s";
	}

	encodeLiveSyncHostUri(hostUri: string): string {
		return querystring.escape(hostUri);
	}

	getLiveSyncNotSupportedError(device: Mobile.IDevice): string {
		return "";
	}

	isLiveSyncSupported(device: Mobile.IDevice): IFuture<boolean> {
		return Future.fromResult(true);
	}

}

export class WP8CompanionAppIdentifier implements Mobile.IAppIdentifier {
	get appIdentifier(): string {
		return "{9155af5b-e7ed-486d-bc6b-35087fb59ecc}";
	}

	get deviceProjectPath(): string {
		return ""; // this is used only on Android for Lollipop
	}

	get liveSyncFormat(): string {
		return "%s/Mist/MobilePackage/redirect?token=%s";
	}

	encodeLiveSyncHostUri(hostUri: string): string {
		return hostUri;
	}

	isLiveSyncSupported(device: any): IFuture<boolean> {
		return Future.fromResult(true);
	}

	getLiveSyncNotSupportedError(device: any): string {
		return "";
	}
}

let factoryRules:IDictionary<any> = {
	iOS: {
		Cordova: {
			companion: IOSCompanionAppIdentifier,
			vanilla: IOSAppIdentifier
		},
		NativeScript: {
			companion: IOSNativeScriptCompanionAppIdentifier
		}
	},
	Android: {
		Cordova: {
			companion: AndroidCompanionAppIdentifier,
			vanilla: AndroidAppIdentifier
		},
		NativeScript: {
			companion: AndroidNativeScriptCompanionAppIdentifier
		}
	},
	WP8: {
		Cordova: {
			companion: WP8CompanionAppIdentifier
		}
	}
};

export function createAppIdentifier(platform: string, appIdentifier: string, companion: boolean): Mobile.IAppIdentifier {
	let project = $injector.resolve("project");
	let ctor = factoryRules[platform][project.projectData.Framework][companion ? "companion" : "vanilla"];
	return new ctor(appIdentifier);
}