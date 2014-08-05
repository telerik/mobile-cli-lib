declare module Config {
	interface IStaticConfig {
		PROJECT_FILE_NAME: string;
		CLIENT_NAME: string;
		ANALYTICS_API_KEY: string;
		version: string;
		helpTextPath: string;
	}

	interface IConfig {
		AB_SERVER?: string;
		AB_SERVER_PROTO?: string;
		DEBUG?: boolean;
		CI_LOGGER?: boolean;
		PROXY_TO_FIDDLER?: boolean;
	}
}