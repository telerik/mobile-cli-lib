// enumeration taken from ProvisionType.cs
export class ProvisionType {
	static Development = "Development";
	static AdHoc = "AdHoc";
	static AppStore = "AppStore";
	static Enterprise = "Enterprise";
}

export let APP_RESOURCES_FOLDER_NAME = "App_Resources";

export let ERROR_NO_DEVICES = "Cannot find connected devices. Reconnect any connected devices, verify that your system recognizes them, and run this command again.";

export let UNREACHABLE_STATUS = "Unreachable";
export let CONNECTED_STATUS = "Connected";

export class LiveSyncConstants {
	static VERSION_2 = 2;
	static VERSION_3 = 3;
	static GUID = "12590FAA-5EDD-4B12-856D-F52A0A1599F2";
	static DEVICE_TMP_DIR_FORMAT_V2 = `/data/local/tmp/${LiveSyncConstants.GUID}/%s`;
	static ANDROID_FILES_PATH = `files/${LiveSyncConstants.GUID}`;
	static DEVICE_TMP_DIR_FORMAT_V3 = `/mnt/sdcard/Android/data/%s/${LiveSyncConstants.ANDROID_FILES_PATH}`;
	static CHECK_LIVESYNC_INTENT_NAME = "com.telerik.IsLiveSyncSupported";
	static IOS_PROJECT_PATH = "/Documents/AppBuilder/LiveSync";
}

export let TARGET_FRAMEWORK_IDENTIFIERS = {
	Cordova: "Cordova",
	NativeScript: "NativeScript"
};

export class Configurations {
	static Debug = "Debug";
	static Release = "Release";
}

export let NODE_MODULES_DIR_NAME = "node_modules";
export let TNS_CORE_MODULES = "tns-core-modules";

export class FileExtensions {
	static TYPESCRIPT_DEFINITION_FILE = ".d.ts";
	static TYPESCRIPT_FILE = ".ts";
}
