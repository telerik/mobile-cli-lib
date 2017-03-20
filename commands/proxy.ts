import * as commandParams from "../command-params";
import { isInteractive } from "../helpers";
import { EOL } from "os";

const proxyGetCommandName = "proxy|*get";
const proxySetCommandName = "proxy|set";
const proxyClearCommandName = "proxy|clear";

export abstract class ProxyCommandBase implements ICommand {
	public disableAnalytics = true;
	public allowedParameters: ICommandParameter[] = [];

	constructor(protected $analyticsService: IAnalyticsService,
		protected $logger: ILogger,
		protected $proxyService: IProxyService,
		private commandName: string) {
	}

	public abstract execute(args: string[]): Promise<void>;

	protected async tryTrackUsage() {
		try {
			await this.$analyticsService.trackFeature(this.commandName);
		} catch (ex) {
			this.$logger.trace("Error in trying to track proxy command usage:");
			this.$logger.trace(ex);
		}
	}
}

export class ProxySetCommand extends ProxyCommandBase {
	public allowedParameters = [new commandParams.StringCommandParameter(this.$injector), new commandParams.StringCommandParameter(this.$injector), new commandParams.StringCommandParameter(this.$injector), new commandParams.StringCommandParameter(this.$injector)];

	constructor(private $errors: IErrors,
		private $injector: IInjector,
		private $prompter: IPrompter,
		protected $analyticsService: IAnalyticsService,
		protected $logger: ILogger,
		protected $proxyService: IProxyService) {
		super($analyticsService, $logger, $proxyService, proxySetCommandName);
	}

	public async execute(args: string[]): Promise<void> {
		let hostname = args[0],
			port = args[1],
			username = args[2],
			password = args[3];

		const noHostName = !hostname;
		const noPort = !port;
		const credentialsRequired = username && !password;

		if (!isInteractive() && (noHostName || noPort || credentialsRequired)) {
			this.$errors.fail("Console is not interactive - you need to supply all command parameters.");
		}

		if (noHostName) {
			hostname = await this.$prompter.getString("Hostname", { allowEmpty: false });
		}

		if (noPort) {
			port = await this.$prompter.getString("Port", { allowEmpty: false });
		}

		if (!username) {
			username = await this.$prompter.getString("Username (Leave empty to omit.)", { defaultAction: () => "" });
		}

		if (credentialsRequired) {
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
		await this.tryTrackUsage();
	}
}

$injector.registerCommand(proxySetCommandName, ProxySetCommand);

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
			message = `Hostname: ${proxyCache.PROXY_HOSTNAME}${EOL}Port: ${proxyCache.PROXY_PORT}`;
			if (proxyCredentials && proxyCredentials.username) {
				message += `${EOL}Username: ${proxyCredentials.username}`;
			}

			message += `${EOL}Proxy is ${proxyCache.USE_PROXY ? "Enabled" : "Disabled"}`;
		} else {
			message = "No proxy set";
		}

		this.$logger.out(message);
		await this.tryTrackUsage();
	}
}

$injector.registerCommand(proxyGetCommandName, ProxyGetCommand);

export class ProxyClearCommand extends ProxyCommandBase {
	constructor(protected $analyticsService: IAnalyticsService,
		protected $logger: ILogger,
		protected $proxyService: IProxyService) {
		super($analyticsService, $logger, $proxyService, proxyClearCommandName);
	}

	public async execute(args: string[]): Promise<void> {
		this.$proxyService.clearCache();
		this.$logger.out("Sucessfully cleared proxy.");
		await this.tryTrackUsage();
	}
}

$injector.registerCommand(proxyClearCommandName, ProxyClearCommand);
