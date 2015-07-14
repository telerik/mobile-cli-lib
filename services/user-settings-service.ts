///<reference path="../.d.ts"/>
"use strict";

export class UserSettingsServiceBase implements UserSettings.IUserSettingsService {
	private userSettingsFilePath: string = null;
	private userSettingsData: any = null;

	constructor(userSettingsFilePath: string,
		private $fs: IFileSystem) {
		this.userSettingsFilePath = userSettingsFilePath;
	}

	public getSettingValue<T>(settingName: string): IFuture<T> {
		return(() => {
			this.loadUserSettingsFile().wait();
			return this.userSettingsData ? this.userSettingsData[settingName] : null;
		}).future<T>()();
	}

	public saveSetting<T>(key: string, value: T): IFuture<void> {
		let settingObject: any = {};
		settingObject[key] = value;

		return	this.saveSettings(settingObject);
	}

	private saveSettings(data: any): IFuture<void> {
		return(() => {
			this.loadUserSettingsFile().wait();
			this.userSettingsData = this.userSettingsData || {};

			Object.keys(data).forEach(propertyName => {
				this.userSettingsData[propertyName] = data[propertyName];
			});

			this.$fs.writeJson(this.userSettingsFilePath, this.userSettingsData, "\t").wait();
		}).future<void>()();
	}

	private loadUserSettingsFile(): IFuture<void> {
		return (() => {
			if(!this.userSettingsData) {
				if(!this.$fs.exists(this.userSettingsFilePath).wait()) {
					this.$fs.writeFile(this.userSettingsFilePath, null).wait();
				}

				this.userSettingsData = this.$fs.readJson(this.userSettingsFilePath).wait();
			}
		}).future<void>()();
	}
}