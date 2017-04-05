import * as path from "path";
import { EOL } from "os";
import { Proxy } from "../constants";

export class ProxyService implements IProxyService {
	private proxyCacheFilePath: string;
	private credentialsKey: string;

	constructor(private $credentialsService: ICredentialsService,
		private $fs: IFileSystem,
		private $options: ICommonOptions,
		private $staticConfig: Config.IStaticConfig) {
		this.proxyCacheFilePath = path.join(this.$options.profileDir, Proxy.CACHE_FILE_NAME);
		this.credentialsKey = `${this.$staticConfig.CLIENT_NAME}_PROXY`;
	}

	public setCache(cacheData: IProxyCache): IProxyCache {
		this.$fs.writeJson(this.proxyCacheFilePath, cacheData);
		return cacheData;
	}

	public getCache(): IProxyCache {
		return this.$fs.exists(this.proxyCacheFilePath) && this.$fs.readJson(this.proxyCacheFilePath);
	}

	public clearCache(): void {
		this.$fs.deleteFile(this.proxyCacheFilePath);
		this.$credentialsService.clearCredentials(this.credentialsKey);
	}

	public async getInfo(): Promise<string> {
		let message = "";
		const proxyCache: IProxyCache = this.getCache();
		if (proxyCache) {
			const proxyCredentials = await this.getCredentials();
			message = `Proxy Url: ${proxyCache.PROXY_PROTOCOL}//${proxyCache.PROXY_HOSTNAME}:${proxyCache.PROXY_PORT}`;
			if (proxyCredentials && proxyCredentials.username) {
				message += `${EOL}Username: ${proxyCredentials.username}`;
			}

			message += `${EOL}Proxy is Enabled`;
		} else {
			message = "No proxy set";
		}

		return message;
	}

	public async getCredentials(): Promise<ICredentials> {
		return this.$credentialsService.getCredentials(this.credentialsKey);
	}

	public async setCredentials(credentials: ICredentials): Promise<ICredentials> {
		return this.$credentialsService.setCredentials(this.credentialsKey, credentials);
	}
}

$injector.register("proxyService", ProxyService);
