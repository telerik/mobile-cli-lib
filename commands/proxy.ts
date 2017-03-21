import * as commandParams from "../command-params";
import { EOL } from "os";

export class ProxySetCommand implements ICommand {
	public disableAnalytics = true;

	public allowedParameters = [new commandParams.StringCommandParameter(this.$injector), new commandParams.StringCommandParameter(this.$injector), new commandParams.StringCommandParameter(this.$injector), new commandParams.StringCommandParameter(this.$injector)];

	constructor(private $injector: IInjector,
		private $logger: ILogger,
		private $prompter: IPrompter,
		private $proxyService: IProxyService) {
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
			await this.$proxyService.setCredentials({
				password,
				username
			});
		}

		const proxyCache: IProxyCache = {
			PROXY_HOSTNAME: hostname,
			PROXY_PORT: +port,
			USE_PROXY: true
		};

		this.$proxyService.setCache(proxyCache);
		this.$logger.out("Sucessfully setup proxy.");
	}
}

$injector.registerCommand("proxy|set", ProxySetCommand);

export class ProxyGetCommand implements ICommand {
	public disableAnalytics = true;

	public allowedParameters: ICommandParameter[] = [];

	constructor(private $logger: ILogger,
		private $proxyService: IProxyService) {
	}

	public async execute(args: string[]): Promise<void> {
		let message = "";
		const proxyCache: IProxyCache = this.$proxyService.getCache();
		if (proxyCache) {
			const proxyCredentials = await this.$proxyService.getCredentials();
			message = `Hostname: ${proxyCache.PROXY_HOSTNAME}${EOL}Port: ${proxyCache.PROXY_PORT}`;
			if (proxyCredentials && proxyCredentials.username) {
				message += `${EOL}Username: ${proxyCredentials.username}`;
			}

			message += `${EOL}PROXY IS ${proxyCache.USE_PROXY ? "ENABLED" : "DISABLED"}`;
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
		private $proxyService: IProxyService) {
	}

	public async execute(args: string[]): Promise<void> {
		// TODO: Clear credentials from vault
		this.$proxyService.clearCache();
		this.$logger.out("Sucessfully cleared proxy.");
	}
}

$injector.registerCommand("proxy|clear", ProxyClearCommand);
