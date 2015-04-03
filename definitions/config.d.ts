declare module Config {
	interface IStaticConfig {
		PROJECT_FILE_NAME: string;
		CLIENT_NAME: string;
		CLIENT_NAME_ALIAS?: string;
		ANALYTICS_API_KEY: string;
		ANALYTICS_INSTALLATION_ID_SETTING_NAME: string;
		TRACK_FEATURE_USAGE_SETTING_NAME: string;
		START_PACKAGE_ACTIVITY_NAME: string;
		SYS_REQUIREMENTS_LINK: string;
		version: string;
		helpTextPath: string;
		adbFilePath: string;
		sevenZipFilePath: string;
		disableAnalytics?: boolean;
		disableHooks?: boolean;
		MAN_PAGES_DIR: string;
		HTML_PAGES_DIR: string;
		HTML_HELPERS_DIR: string;
	}

	interface IConfig {
		AB_SERVER?: string;
		AB_SERVER_PROTO?: string;
		DEBUG?: boolean;
		PROXY_HOSTNAME?: string;
		USE_PROXY?: boolean;
		PROXY_PORT?: number;
		CI_LOGGER?: boolean;
		TYPESCRIPT_COMPILER_OPTIONS?: any;
	}
}