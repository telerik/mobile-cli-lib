import * as commandParams from "../command-params";

export class ProxySetCommand implements ICommand {
	public disableAnalytics = true;

	public allowedParameters = [new commandParams.StringCommandParameter(this.$injector), new commandParams.StringCommandParameter(this.$injector), new commandParams.StringCommandParameter(this.$injector), new commandParams.StringCommandParameter(this.$injector)];

	constructor(private $injector: IInjector,
		private $logger: ILogger,
		private $prompter: IPrompter,
		private $proxyCacheService: IProxyCacheService) {
	}

	public async execute(args: string[]): Promise<void> {
		let hostname = args[0],
			port = args[1],
			username = args[2],
			password = args[3];

		if (!hostname) {
			hostname = await this.$prompter.getString("Hostname", { allowEmpty: false });
		}

		if (!port) {
			port = await this.$prompter.getString("Port", { allowEmpty: false });
		}

		if (!username) {
			username = await this.$prompter.getString("Username", { defaultAction: () => "" });
		}

		if (username && !password) {
			password = await this.$prompter.getPassword("Password");
		}

		if (username && password) {
			await this.$proxyCacheService.setCredentials({
				password,
				username
			});
		}

		const proxyCache: IProxyCache = {
			PROXY_HOSTNAME: hostname,
			PROXY_PORT: +port,
			USE_PROXY: true
		};

		this.$proxyCacheService.setCache(proxyCache);
		this.$logger.out("Sucessfully setup proxy.");
	}
}

$injector.registerCommand("proxy|set", ProxySetCommand);

export class ProxyGetCommand implements ICommand {
	public disableAnalytics = true;

	public allowedParameters: ICommandParameter[] = [];

	constructor(private $logger: ILogger,
		private $proxyCacheService: IProxyCacheService) {
	}

	public async execute(args: string[]): Promise<void> {
		let message = "";
		const proxyCache: IProxyCache = this.$proxyCacheService.getCache();
		if (proxyCache) {
			const proxyCredentials = await this.$proxyCacheService.getCredentials();
			message = `Hostname: ${proxyCache.PROXY_HOSTNAME}\nPort: ${proxyCache.PROXY_PORT}`;
			if (proxyCredentials && proxyCredentials.username) {
				message += `\nUsername: ${proxyCredentials.username}`;
			}

			message += `\nPROXY IS ${proxyCache.USE_PROXY ? "ENABLED" : "DISABLED"}`;
		} else {
			message = "No proxy set";
		}

		this.$logger.out(message);
	}
}

$injector.registerCommand("proxy|*get", ProxyGetCommand);

export class ProxyClearCommand implements ICommand {
	public disableAnalytics = true;

	public allowedParameters: ICommandParameter[] = [];

	constructor(private $logger: ILogger,
		private $proxyCacheService: IProxyCacheService) {
	}

	public async execute(args: string[]): Promise<void> {
		// TODO: Clear credentials from vault
		this.$proxyCacheService.clearCache();
		this.$logger.out("Sucessfully cleared proxy.");
	}
}

$injector.registerCommand("proxy|clear", ProxyClearCommand);
