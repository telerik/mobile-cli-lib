declare module UserSettings {
	interface IUserSettingsService {
		getSettingValue<T>(settingName: string): IFuture<T>;
		saveSetting<T>(key: string, value: T): IFuture<void>;
		removeSetting(key: string): IFuture<void>;
	}
}