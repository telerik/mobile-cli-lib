// enumeration taken from ProvisionType.cs

export class ProvisionType {
	static Development = "Development";
	static AdHoc = "AdHoc";
	static AppStore = "AppStore";
	static Enterprise = "Enterprise";
}

export let ERROR_NO_DEVICES = "Cannot find connected devices. Reconnect any connected devices, verify that your system recognizes them, and run this command again.";

// LiveSync constants
export var CHECK_LIVESYNC_INTENT_NAME = "com.telerik.IsLiveSyncSupported";
