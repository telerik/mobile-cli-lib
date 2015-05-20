// enumeration taken from ProvisionType.cs

export class ProvisionType {
	static Development = "Development";
	static AdHoc = "AdHoc";
	static AppStore = "AppStore";
	static Enterprise = "Enterprise";

	static get AllProvisions(): string[] {
		let result: string[] = [],
			keys = Object.keys(ProvisionType);
		for(let key in keys) {
			if (keys[key] === 'AllProvisions') {
				continue;
			}

			result.push(keys[key]);
		}

		return result;
	}
}

export let ERROR_NO_DEVICES = "Cannot find connected devices. Reconnect any connected devices, verify that your system recognizes them, and run this command again.";