 // enumeration taken from ProvisionType.cs
"use strict";

export class ProvisionType {
	static Development = "Development";
	static AdHoc = "AdHoc";
	static AppStore = "AppStore";
	static Enterprise = "Enterprise";
}

export let ERROR_NO_DEVICES = "Cannot find connected devices. Reconnect any connected devices, verify that your system recognizes them, and run this command again.";

export let UNREACHABLE_STATUS = "Unreachable";
export let CONNECTED_STATUS = "Connected";

export class LiveSyncConstants {
	static DEVICE_TMP_DIR_FORMAT_V2 = "/data/local/tmp/12590FAA-5EDD-4B12-856D-F52A0A1599F2/%s";
	static DEVICE_TMP_DIR_FORMAT_V3 = "/mnt/sdcard/Android/data/%s/files/12590FAA-5EDD-4B12-856D-F52A0A1599F2";
	static CHECK_LIVESYNC_INTENT_NAME = "com.telerik.IsLiveSyncSupported";
	static IOS_PROJECT_PATH = "/Library/Application Support/LiveSync";
}
