import { EOL } from "os";
import { ProxyCommandBase } from "./proxy-base";

const proxyGetCommandName = "proxy|*get";

export class ProxyGetCommand extends ProxyCommandBase {
	constructor(protected $analyticsService: IAnalyticsService,
		protected $logger: ILogger,
		protected $proxyService: IProxyService) {
		super($analyticsService, $logger, $proxyService, proxyGetCommandName);
	}

	public async execute(args: string[]): Promise<void> {
		let message = "";
		const proxyCache: IProxyCache = this.$proxyService.getCache();
		if (proxyCache) {
			const proxyCredentials = await this.$proxyService.getCredentials();
			message = `Proxy Url: ${proxyCache.PROXY_PROTOCOL}://${proxyCache.PROXY_HOSTNAME}:${proxyCache.PROXY_PORT}`;
			if (proxyCredentials && proxyCredentials.username) {
				message += `${EOL}Username: ${proxyCredentials.username}`;
			}

			message += `${EOL}Proxy is Enabled`;
		} else {
			message = "No proxy set";
		}

		this.$logger.out(message);
		await this.tryTrackUsage();
	}
}

$injector.registerCommand(proxyGetCommandName, ProxyGetCommand);
