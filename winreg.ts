import Future = require("fibers/future");
let Registry = require("winreg");

export class WinReg implements IWinReg {
	public registryKeys: IHiveIds = {
		HKLM: { registry: Registry.HKLM },
		HKCU: { registry: Registry.HKCU },
		HKCR: { registry: Registry.HKCR },
		HKCC: { registry: Registry.HKCC },
		HKU: { registry: Registry.HKU }
	};

	public async getRegistryValue(valueName: string, hive?: IHiveId, key?: string, host?: string): Promise<IWinRegResult> {
		let future = new Future<IWinRegResult>();
		try {
			let regKey = new Registry({
				hive: (hive && hive.registry) ? hive.registry : null,
				key:  key,
				host: host
			});

			regKey.get(valueName, (err: Error, value: IWinRegResult) => {
				if (err) {
					future.throw(err);
				} else {
					future.return(value);
				}
			});
		} catch(err) {
			future.throw(err);
		}

		return future;
	}
}
$injector.register("winreg", WinReg);
