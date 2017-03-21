import * as path from "path";
import * as crypto from "crypto";
import { platform } from "os";

export class CredentialsService implements ICredentialsService {
	private static USERNAME_REGEX = /username\s+:\s(.*)/i;
	private static PASSWORD_REGEX = /password\s+:\s(.*)/i;
	private static ENCRYPTION_ALGORITHM = "aes-256-ctr";
	private static ENCRYPTION_KEY = "6Gsz97KBp293Q0r0ei4pix98V4PIhm2D";
	private pathToWindowsHelperScript: string;

	constructor(private $childProcess: IChildProcess,
		private $hostInfo: IHostInfo) {
		this.pathToWindowsHelperScript = path.join(__dirname, "..", "vendor", "WinCredentialsHelper.ps1");
	}

	public async setCredentials(key: string, credentials: ICredentials): Promise<ICredentials> {
		if (this.$hostInfo.isWindows) {
			await this.$childProcess.spawnFromEvent("powershell.exe", [this.pathToWindowsHelperScript, "-AddCred", "-Target", key, "-User", credentials.username, "-Pass", this.encrypt(credentials.password)], "close");
			return credentials;
		} else {
			throw new Error(`Storing credentials is not supported on ${platform()} yet.`);
		}
	}

	public async getCredentials(key: string): Promise<ICredentials> {
		if (this.$hostInfo.isWindows) {
			let credentialsSpawnResult = await this.$childProcess.spawnFromEvent("powershell.exe", [this.pathToWindowsHelperScript, "-GetCred", "-Target", key], "close");
			let usernameGroup = CredentialsService.USERNAME_REGEX.exec(credentialsSpawnResult.stdout);
			let passwordGroup = CredentialsService.PASSWORD_REGEX.exec(credentialsSpawnResult.stdout);
			return {
				username: usernameGroup && usernameGroup[1],
				password: passwordGroup && passwordGroup[1] && this.decrypt(passwordGroup[1])
			};
		} else {
			throw new Error(`Storing credentials is not supported on ${platform()} yet.`);
		}
	}

	public async clearCredentials(key: string): Promise<void> {
		if (this.$hostInfo.isWindows) {
			await this.$childProcess.spawnFromEvent("powershell.exe", [this.pathToWindowsHelperScript, "-DelCred", "-Target", key], "close");
		} else {
			throw new Error(`Storing credentials is not supported on ${platform()} yet.`);
		}
	}

	private encrypt(text: string): string {
		const cipher = crypto.createCipher(CredentialsService.ENCRYPTION_ALGORITHM, CredentialsService.ENCRYPTION_KEY);
		let crypted = cipher.update(text, 'utf8', 'hex');
		crypted += cipher.final('hex');
		return crypted;
	}

	private decrypt(text: string): string {
		const decipher = crypto.createDecipher(CredentialsService.ENCRYPTION_ALGORITHM, CredentialsService.ENCRYPTION_KEY);
		let dec = decipher.update(text, 'hex', 'utf8');
		dec += decipher.final('utf8');
		return dec;
	}
}

$injector.register("credentialsService", CredentialsService);
