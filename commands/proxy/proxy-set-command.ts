import * as commandParams from "../../command-params";
import { isInteractive } from "../../helpers";
import { ProxyCommandBase } from "./proxy-base-command";

const proxySetCommandName = "proxy|set";

export class ProxySetCommand extends ProxyCommandBase {
	public allowedParameters = [
		new commandParams.StringCommandParameter(this.$injector),
		new commandParams.StringCommandParameter(this.$injector),
		new commandParams.StringCommandParameter(this.$injector),
		new commandParams.StringCommandParameter(this.$injector)
	];

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
		const noPort = !port || !this.isValidPort(port);

		if (!isInteractive() && (noHostName || noPort || this.isPasswordRequired(username, password))) {
			this.$errors.fail("Console is not interactive - you need to supply all command parameters.");
		}

		if (noHostName) {
			hostname = await this.$prompter.getString("Hostname", { allowEmpty: false });
		}

		if (noPort) {
			if (port) {
				this.$logger.warn(this.getInvalidPortMessage(port));
			}

			port = await this.getPortFromUserInput();
		}

		if (!username) {
			this.$logger.info("In case your proxy requires authentication, please specify username and password. If authentication is not required, just leave it empty.");
			username = await this.$prompter.getString("Username", { defaultAction: () => "" });
		}

		if (this.isPasswordRequired(username, password)) {
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
			PROXY_PORT: +port
		};

		this.$proxyService.setCache(proxyCache);
		this.$logger.out("Successfully setup proxy.");

		await this.tryTrackUsage();
	}

	private isPasswordRequired(username: string, password: string): boolean {
		return !!(username && !password);
	}

	private isValidPort(port: string): boolean {
		const parsedPortNumber = parseInt(port);
		return !isNaN(parsedPortNumber) && parsedPortNumber > 0 && parsedPortNumber < 65536;
	}

	private async getPortFromUserInput(): Promise<string> {
		const schemaName = "port";
		const schema: IPromptSchema = {
			message: "Port",
			type: "input",
			name: schemaName,
			validate: (value: any) => {
				return (!value || !this.isValidPort(value)) ? this.getInvalidPortMessage(value) : true;
			}
		};

		const prompterResult = await this.$prompter.get([schema]);
		return prompterResult[schemaName];
	}

	private getInvalidPortMessage(port: string): string {
		return `Specified port ${port} is not valid. Please enter a value between 1 and 65535.`;
	}
}

$injector.registerCommand(proxySetCommandName, ProxySetCommand);
