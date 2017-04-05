// enumeration taken from ProvisionType.cs
export class ProvisionType {
	static Development = "Development";
	static AdHoc = "AdHoc";
	static AppStore = "AppStore";
	static Enterprise = "Enterprise";
}

export const APP_RESOURCES_FOLDER_NAME = "App_Resources";

export const ERROR_NO_DEVICES = "Cannot find connected devices. Reconnect any connected devices, verify that your system recognizes them, and run this command again.";

export const UNREACHABLE_STATUS = "Unreachable";
export const CONNECTED_STATUS = "Connected";

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

export const TARGET_FRAMEWORK_IDENTIFIERS = {
	Cordova: "Cordova",
	NativeScript: "NativeScript"
};

export class Configurations {
	static Debug = "Debug";
	static Release = "Release";
}

export const NODE_MODULES_DIR_NAME = "node_modules";
export const TNS_CORE_MODULES = "tns-core-modules";

export class FileExtensions {
	static TYPESCRIPT_DEFINITION_FILE = ".d.ts";
	static TYPESCRIPT_FILE = ".ts";
	static PNG_FILE = ".png";
	static NINE_PATCH_PNG_FILE = ".9.png";
}

export const IOS_POST_NOTIFICATION_COMMAND_TYPE = "PostNotification";
export const IOS_OBSERVE_NOTIFICATION_COMMAND_TYPE = "ObserveNotification";
export const IOS_RELAY_NOTIFICATION_COMMAND_TYPE = "RelayNotification";

export class Proxy {
	static CACHE_FILE_NAME = "proxy-cache.json";
	static USE_PROXY = "USE_PROXY";
	static PROXY_PORT = "PROXY_PORT";
	static PROXY_HOSTNAME = "PROXY_HOSTNAME";
}

/**
 * Http status codes available from `require("http").STATUS_CODES`.
 */
export class HttpStatusCodes {
	static SEE_OTHER = 303;
	static PAYMENT_REQUIRED = 402;
	static PROXY_AUTHENTICATION_REQUIRED = 407;
}

export const HttpProtocolToPort: IDictionary<number> = {
	'http:': 80,
	'https:': 443
};
