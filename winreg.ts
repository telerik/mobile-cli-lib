const Registry = require("winreg");

export class WinReg implements IWinReg {
	public registryKeys: IHiveIds = {
		HKLM: { registry: Registry.HKLM },
		HKCU: { registry: Registry.HKCU },
		HKCR: { registry: Registry.HKCR },
		HKCC: { registry: Registry.HKCC },
		HKU: { registry: Registry.HKU }
	};

	public async getRegistryValue(valueName: string, hive?: IHiveId, key?: string, host?: string): Promise<IWinRegResult> {
		return new Promise<IWinRegResult>((resolve, reject) => {
			try {
				const regKey = new Registry({
					hive: (hive && hive.registry) ? hive.registry : null,
					key: key,
					host: host
				});

				regKey.get(valueName, (err: Error, value: IWinRegResult) => {
					if (err) {
						reject(err);
					} else {
						resolve(value);
					}
				});
			} catch (err) {
				reject(err);
			}

		});
	}
}
$injector.register("winreg", WinReg);
