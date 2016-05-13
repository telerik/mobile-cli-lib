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

/**
 * Describes available methods for LiveSync operation from Proton.
 */
interface IProtonLiveSyncService {
	/**
	 * Sends files to specified devices.
	 * @param {IDeviceLiveSyncInfo[]} deviceDescriptors Descriptions of the devices, which includes device identifiers and what should be synced.
	 * @param {string} projectDir Project directory.
	 * @param {string[]} filePaths Passed only in cases when only some of the files must be synced.
	 * @return {IDeviceLiveSyncResult[]} Information about each LiveSync operation.
	 */
	livesync(deviceDescriptors: IDeviceLiveSyncInfo[], projectDir: string, filePaths?: string[]): IFuture<IDeviceLiveSyncResult>[];
}

/**
 * Describes the result of a single livesync operation started by Proton.
 */
interface ILiveSyncOperationResult {
	/**
	 * Defines if the operation is successful (set to true) or not (value is false).
	 */
	isResolved: boolean;

	/**
	 * Error when livesync operation fails. If `isResolved` is true, error will be undefined.
	 */
	error?: Error;
}

/**
 * Describes result of all LiveSync operations per device.
 */
interface IDeviceLiveSyncResult {
	/**
	 * Identifier of the device.
	 */
	deviceIdentifier: string;

	/**
	 * Result of LiveSync operation for application.
	 */
	liveSyncToApp?: ILiveSyncOperationResult;

	/**
	 * Result of LiveSync operation to companion app.
	 */
	liveSyncToCompanion?: ILiveSyncOperationResult;
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

/**
 * Describes if LiveSync is supported for specific device and application.
 */
interface ILiveSyncSupportedInfo {
	/**
	 * Unique identifier of the device.
	 */
	deviceIdentifier: string;

	/**
	 * Application identifier.
	 */
	appIdentifier: string;

	/**
	 * Result, indicating is livesync supported for specified device and specified application.
	 * `true` in case livesync is supported and false otherwise.
	 */
	isLiveSyncSupported: boolean;
}

/**
 * Describes if LiveSync is supported for specific device and application.
 */
interface IAppInstalledInfo extends ILiveSyncSupportedInfo {
	/**
	 * Defines if application is installed on device.
	 */
	isInstalled: boolean;
}

/**
 * Describes information about Telerik Companion Apps.
 */
interface ICompanionAppsService {
	/**
	 * Returns application identifier of the companion app for specified platform and framework.
	 * @param {string} framework The framework for which Companion app identfier should be checked. Valid values are cordova and nativescript
	 * @param {string} platform The device platform. Valid values are android, ios and wp8.
	 * @return {string} Companion appIdentifier or null.
	 */
	getCompanionAppIdentifier(framework: string, platform: string): string;

	/**
	 * Returns all companion application identifiers in a dictionary where the top level keys are framwork identifiers.
	 * For each framework there are three values, specified in a dictionary. The keys of the dictionary are platforms (android, ios and wp8).
	 * @return {string} Companion appIdentifier or null.
	 */
	getAllCompanionAppIdentifiers(): IDictionary<IStringDictionary>;
}
