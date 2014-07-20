interface IConfig {
	client: string;
	version: string;
	helpTextPath: string;
	PROJECT_FILE_NAME: string;

	DEBUG?: boolean;
	AB_SERVER?: string;
	AB_SERVER_PROTO?: string;
	PROXY_TO_FIDDLER?: boolean;
}