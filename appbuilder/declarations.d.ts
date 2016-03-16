interface ILiveSyncDeviceAppData extends Mobile.IDeviceAppData {
	liveSyncFormat: string;
	encodeLiveSyncHostUri(hostUri: string): string;
	getLiveSyncNotSupportedError(): string;
}

interface IDeployHelper {
	deploy(platform?: string): IFuture<void>;
}

interface ITargetFrameworkIdentifiers {
	Cordova: string;
	NativeScript: string;
}

interface IProjectConstants {
	PROJECT_FILE: string;
	PROJECT_IGNORE_FILE: string;
	DEBUG_CONFIGURATION_NAME: string;
	DEBUG_PROJECT_FILE_NAME: string;
	RELEASE_CONFIGURATION_NAME: string;
	RELEASE_PROJECT_FILE_NAME: string;
	CORE_PLUGINS_PROPERTY_NAME: string;
	CORDOVA_PLUGIN_VARIABLES_PROPERTY_NAME: string;
	TARGET_FRAMEWORK_IDENTIFIERS: ITargetFrameworkIdentifiers;
	APPIDENTIFIER_PROPERTY_NAME: string;
	EXPERIMENTAL_TAG: string;
	NATIVESCRIPT_APP_DIR_NAME: string;
	IMAGE_DEFINITIONS_FILE_NAME: string;
	PACKAGE_JSON_NAME: string;
}

interface IPathFilteringService {
	getRulesFromFile(file: string) : string[];
	filterIgnoredFiles(files: string[], rules: string[], rootDir: string) :string[];
	isFileExcluded(file: string, rules: string[], rootDir: string): boolean
}
