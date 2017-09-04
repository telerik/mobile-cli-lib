import * as os from "os";

export class OsInfo implements IOsInfo {
	public type(): string {
		return os.type();
	}

	public release(): string {
		return os.release();
	}

	public arch(): string {
		return os.arch();
	}
}

$injector.register("osInfo", OsInfo);
