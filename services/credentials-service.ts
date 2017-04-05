import * as path from "path";
import * as crypto from "crypto";
import { platform, EOL } from "os";

export class CredentialsService implements ICredentialsService {
	private static ENCRYPTION_ALGORITHM = "aes-256-ctr";
	private static ENCRYPTION_KEY = "6Gsz97KBp293Q0r0ei4pix98V4PIhm2D";
	private pathToWindowsCredentialsManager: string;

	constructor(private $childProcess: IChildProcess,
		private $hostInfo: IHostInfo,
		private $logger: ILogger) {
		this.pathToWindowsCredentialsManager = path.join(__dirname, "..", "vendor", platform(), "CredentialsManager.exe");
	}

	public async setCredentials(key: string, credentials: ICredentials): Promise<ICredentials> {
		if (this.$hostInfo.isWindows) {
			await this.$childProcess.spawnFromEvent(this.pathToWindowsCredentialsManager, ["set", key, credentials.username, this.encrypt(credentials.password)], "close");
			return credentials;
		} else {
			throw new Error(`Storing credentials is not supported on ${platform()} yet.`);
		}
	}

	public async getCredentials(key: string): Promise<ICredentials> {
		if (this.$hostInfo.isWindows) {
			const credentialsSpawnResult = await this.$childProcess.spawnFromEvent(this.pathToWindowsCredentialsManager, ["get", key], "close", {}, { throwError: false });
			const credentialsSplit = credentialsSpawnResult && credentialsSpawnResult.stdout && credentialsSpawnResult.stdout.split(EOL);
			return {
				username: credentialsSplit && credentialsSplit[0],
				password: credentialsSplit && this.decrypt(credentialsSplit[1])
			};
		} else {
			this.$logger.trace(`Storing credentials is not supported on ${platform()} yet.`);
		}
	}

	public async clearCredentials(key: string): Promise<void> {
		if (this.$hostInfo.isWindows) {
			await this.$childProcess.spawnFromEvent(this.pathToWindowsCredentialsManager, ["clear", key], "close");
		} else {
			this.$logger.trace(`Storing credentials is not supported on ${platform()} yet.`);
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
