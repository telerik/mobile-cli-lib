import * as commandParams from "../../command-params";
import { isInteractive } from "../../helpers";
import { ProxyCommandBase } from "./proxy-base";
import { HttpProtocolToPort } from "../../constants";
import { parse } from "url";

const proxySetCommandName = "proxy|set";

export class ProxySetCommand extends ProxyCommandBase {
	public allowedParameters = [
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
		let urlString = args[0],
			username = args[1],
			password = args[2];

		const noUrl = !urlString;
		if (noUrl) {
			if (!isInteractive()) {
				this.$errors.fail("Console is not interactive - you need to supply all command parameters.");
			} else {
				urlString = await this.$prompter.getString("Url", { allowEmpty: false });
			}
		}

		const urlObj = parse(urlString);
		let port = urlObj.port && +urlObj.port || HttpProtocolToPort[urlObj.protocol];
		const noPort = !port || !this.isValidPort(port);
		const authCredentials = this.getCredentialsFromAuth(urlObj.auth || "");
		username = username || authCredentials.username;
		password = password || authCredentials.password;

		if (!isInteractive() && (noPort || this.isPasswordRequired(username, password))) {
			this.$errors.fail("Console is not interactive - you need to supply all command parameters.");
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
			PROXY_HOSTNAME: urlObj.hostname,
			PROXY_PORT: port,
			PROXY_PROTOCOL: urlObj.protocol
		};

		this.$proxyService.setCache(proxyCache);
		this.$logger.out("Successfully setup proxy.");

		await this.tryTrackUsage();
	}

	private getCredentialsFromAuth(auth: string): ICredentials {
		const colonIndex = auth.indexOf(":");
		let username = "";
		let password = "";
		if (colonIndex > -1) {
			username = auth.substring(0, colonIndex);
			password = auth.substring(colonIndex + 1);
		}

		return { username, password };
	}

	private isPasswordRequired(username: string, password: string): boolean {
		return !!(username && !password);
	}

	private isValidPort(port: number): boolean {
		return !isNaN(port) && port > 0 && port < 65536;
	}

	private async getPortFromUserInput(): Promise<number> {
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
		return parseInt(prompterResult[schemaName]);
	}

	private getInvalidPortMessage(port: number): string {
		return `Specified port ${port} is not valid. Please enter a value between 1 and 65535.`;
	}
}

$injector.registerCommand(proxySetCommandName, ProxySetCommand);
