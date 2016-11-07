import * as os from "os";

export class OsInfo implements IOsInfo {
	public type(): string {
		return os.type();
	}

	public release(): string {
		return os.release();
	}
}

$injector.register("osInfo", OsInfo);
