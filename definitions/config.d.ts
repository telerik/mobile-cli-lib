declare module Config {
	interface IStaticConfig {
		PROJECT_FILE_NAME: string;
		CLIENT_NAME_KEY_IN_PROJECT_FILE?: string;
		CLIENT_NAME: string;
		CLIENT_NAME_ALIAS?: string;
		FULL_CLIENT_NAME?: string;
		ANALYTICS_API_KEY: string;
		ANALYTICS_INSTALLATION_ID_SETTING_NAME: string;
		TRACK_FEATURE_USAGE_SETTING_NAME: string;
		ERROR_REPORT_SETTING_NAME: string;
		SYS_REQUIREMENTS_LINK: string;
		version: string;
		helpTextPath: string;
		getAdbFilePath(): IFuture<string>;
		disableAnalytics?: boolean;
		disableCommandHooks?: boolean;
		enableDeviceRunCommandOnWindows?: boolean;
		MAN_PAGES_DIR: string;
		HTML_PAGES_DIR: string;
		HTML_COMMON_HELPERS_DIR: string;
		HTML_CLI_HELPERS_DIR: string;
		pathToPackageJson: string;
		APP_RESOURCES_DIR_NAME: string;
		COMMAND_HELP_FILE_NAME: string;
		RESOURCE_DIR_PATH: string;
		PATH_TO_BOOTSTRAP: string;
		INSTALLATION_SUCCESS_MESSAGE?: string;
	}

	interface IConfig {
		AB_SERVER?: string;
		AB_SERVER_PROTO?: string;
		DEBUG?: boolean;
		PROXY_HOSTNAME?: string;
		USE_PROXY?: boolean;
		PROXY_PORT?: number;
		ON_PREM?: boolean;
		CI_LOGGER?: boolean;
		TYPESCRIPT_COMPILER_OPTIONS?: any;
		DISABLE_HOOKS: boolean;
	}
}
