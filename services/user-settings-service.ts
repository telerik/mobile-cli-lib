export class UserSettingsServiceBase implements IUserSettingsService {
	private userSettingsFilePath: string = null;
	protected userSettingsData: any = null;

	constructor(userSettingsFilePath: string,
		protected $fs: IFileSystem) {
		this.userSettingsFilePath = userSettingsFilePath;
	}

	public async getSettingValue<T>(settingName: string): Promise<T> {
			this.loadUserSettingsFile().wait();
			return this.userSettingsData ? this.userSettingsData[settingName] : null;
	}

	public saveSetting<T>(key: string, value: T): IFuture<void> {
		let settingObject: any = {};
		settingObject[key] = value;

		return this.saveSettings(settingObject);
	}

	public async removeSetting(key: string): Promise<void> {
			this.loadUserSettingsFile().wait();

			delete this.userSettingsData[key];
			this.saveSettings().wait();
	}

	public async saveSettings(data?: any): Promise<void> {
			this.loadUserSettingsFile().wait();
			this.userSettingsData = this.userSettingsData || {};

			_(data)
				.keys()
				.each(propertyName => {
					this.userSettingsData[propertyName] = data[propertyName];
				});

			this.$fs.writeJson(this.userSettingsFilePath, this.userSettingsData);
	}

	// TODO: Remove IFuture, reason: writeFile - blocked as other implementation of the interface has async operation.
	public async loadUserSettingsFile(): Promise<void> {
			if(!this.userSettingsData) {
				if(!this.$fs.exists(this.userSettingsFilePath)) {
					this.$fs.writeFile(this.userSettingsFilePath, null);
				}

				this.userSettingsData = this.$fs.readJson(this.userSettingsFilePath);
			}
	}
}
