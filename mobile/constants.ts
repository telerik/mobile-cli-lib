// enumeration taken from ProvisionType.cs
"use strict";

export class ProvisionType {
	static Development = "Development";
	static AdHoc = "AdHoc";
	static AppStore = "AppStore";
	static Enterprise = "Enterprise";
}

export let ERROR_NO_DEVICES = "Cannot find connected devices. Reconnect any connected devices, verify that your system recognizes them, and run this command again.";

// LiveSync constants
export let CHECK_LIVESYNC_INTENT_NAME = "com.telerik.IsLiveSyncSupported";

export let UNREACHABLE_STATUS = "Unreachable";
export let CONNECTED_STATUS = "Connected";
