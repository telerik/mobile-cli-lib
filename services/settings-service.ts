import { exported } from "../decorators";

export class SettingsService implements ISettingsService {
	constructor(private $staticConfig: Config.IStaticConfig) { }

	@exported("settingsService")
	setSettings(settings: IConfigurationSettings): void {
		if (settings.userAgentName) {
			this.$staticConfig.USER_AGENT_NAME = settings.userAgentName;
		}
	}
}

$injector.register("settingsService", SettingsService);
