import * as path from "path";
import { Proxy } from "../constants";

export class ProxyCacheService implements IProxyCacheService {
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

	public async getCredentials(): Promise<ICredentials> {
		return this.$credentialsService.getCredentials(this.credentialsKey);
	}

	public async setCredentials(credentials: ICredentials): Promise<ICredentials> {
		return this.$credentialsService.setCredentials(this.credentialsKey, credentials);
	}
}

$injector.register("proxyCacheService", ProxyCacheService);
