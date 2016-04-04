interface ILiveSyncDeviceAppData extends Mobile.IDeviceAppData {
	liveSyncFormat: string;
	encodeLiveSyncHostUri(hostUri: string): string;
	getLiveSyncNotSupportedError(): string;
}

interface IDeployHelper {
	deploy(platform?: string): IFuture<void>;
}

declare module Project {
	interface ITargetFrameworkIdentifiers {
		Cordova: string;
		NativeScript: string;
	}

	interface IConstants {
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
		ADDITIONAL_FILE_DISPOSITION: string;
		ADDITIONAL_FILES_DIRECTORY: string;
	}

	interface ICapabilities {
		build: boolean;
		buildCompanion: boolean;
		deploy: boolean
		simulate: boolean;
		livesync: boolean;
		livesyncCompanion: boolean;
		updateKendo: boolean;
		emulate: boolean;
		publish: boolean;
		uploadToAppstore: boolean;
		canChangeFrameworkVersion: boolean;
		imageGeneration: boolean;
		wp8Supported: boolean;
	}

	interface IData extends IDictionary<any> {
		ProjectName: string;
		ProjectGuid: string;
		projectVersion : number;
		AppIdentifier: string;
		DisplayName: string;
		Author: string;
		Description: string;
		BundleVersion: string;
		Framework: string;
		FrameworkVersion: string;
		CorePlugins: string[];
		AndroidPermissions: string[];
		DeviceOrientations: string[];
		AndroidHardwareAcceleration: string;
		AndroidVersionCode: string;
		iOSStatusBarStyle: string;
		iOSDeviceFamily: string[];
		iOSBackgroundMode: string[];
		iOSDeploymentTarget: string;
		WP8ProductID: string;
		WP8PublisherID: string;
		WP8Publisher: string;
		WP8TileTitle: string;
		WP8Capabilities: string[];
		WP8Requirements: string[];
		WP8SupportedResolutions: string[];
		WPSdk?: string;
		WP8PackageIdentityName?: string;
		WP8WindowsPublisherName?: string;
		CordovaPluginVariables?: any;
	}

	interface IProjectBase {
		projectDir: string;
		getProjectDir(): IFuture<string>;
		projectData: IData;
		capabilities: ICapabilities;
	}
}

interface IPathFilteringService {
	getRulesFromFile(file: string) : string[];
	filterIgnoredFiles(files: string[], rules: string[], rootDir: string) :string[];
	isFileExcluded(file: string, rules: string[], rootDir: string): boolean
}

interface IProtonLiveSyncService {
	livesync(deviceIdentifiers: IDeviceLiveSyncInfo[], projectDir: string, filePaths: string[]): IFuture<void>;
}

/**
 * Describes device's LiveSync information.
 */
interface IDeviceLiveSyncInfo {
	/**
	 * Unique identifier of the device.
	 */
	deviceIdentifier: string;

	/**
	 * Defines if changes have to be synced to installed application.
	 */
	syncToApp: boolean;

	/**
	 * Defines if changes have to be synced to companion app.
	 */
	syncToCompanion: boolean;
}

interface ICompanionAppsService {
	getCompanionAppIdentifier(framework: string, platform: string): string;
}
