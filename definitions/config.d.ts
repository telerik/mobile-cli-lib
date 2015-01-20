declare module Config {
	interface IStaticConfig {
		PROJECT_FILE_NAME: string;
		CLIENT_NAME: string;
		CLIENT_NAME_ALIAS?: string;
		ANALYTICS_API_KEY: string;
		ANALYTICS_INSTALLATION_ID_SETTING_NAME: string;
		TRACK_FEATURE_USAGE_SETTING_NAME: string;
		START_PACKAGE_ACTIVITY_NAME: string;
		version: string;
		helpTextPath: string;
		adbFilePath: string;
		sevenZipFilePath: string;
	}

	interface IConfig {
		AB_SERVER?: string;
		AB_SERVER_PROTO?: string;
		DEBUG?: boolean;
		FIDDLER_HOSTNAME?: string;
		CI_LOGGER?: boolean;
		PROXY_TO_FIDDLER?: boolean;
		TYPESCRIPT_COMPILER_OPTIONS?: any;
	}
}