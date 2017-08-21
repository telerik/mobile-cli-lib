import * as path from "path";
import * as util from "util";
import { Configurations } from "../constants";

export abstract class ProjectFilesProviderBase implements IProjectFilesProvider {
	abstract isFileExcluded(filePath: string): boolean;
	abstract mapFilePath(filePath: string, platform: string, projectData: any, projectFilesConfig: IProjectFilesConfig): string;

	constructor(private $mobileHelper: Mobile.IMobileHelper,
		protected $options: ICommonOptions) { }

	public getPreparedFilePath(filePath: string, projectFilesConfig?: IProjectFilesConfig): string {
		let projectFileInfo = this.getProjectFileInfo(filePath, "", projectFilesConfig);
		return path.join(path.dirname(filePath), projectFileInfo.onDeviceFileName);
	}

	public getProjectFileInfo(filePath: string, platform: string, projectFilesConfig?: IProjectFilesConfig): IProjectFileInfo {
		if (!filePath) {
			return {
				filePath: filePath,
				onDeviceFileName: filePath,
				shouldIncludeFile: false
			};
		}

		let parsed = this.parseFile(filePath, this.$mobileHelper.platformNames, platform || "");
		let basicConfigurations = [Configurations.Debug.toLowerCase(), Configurations.Release.toLowerCase()];
		if (!parsed) {

			let validValues = basicConfigurations.concat(projectFilesConfig && projectFilesConfig.additionalConfigurations || []),
				value = projectFilesConfig && projectFilesConfig.configuration || basicConfigurations[0];
			parsed = this.parseFile(filePath, validValues, value);
		}

		return parsed || {
			filePath: filePath,
			onDeviceFileName: path.basename(filePath),
			shouldIncludeFile: true
		};
	}

	private parseFile(filePath: string, validValues: string[], value: string): IProjectFileInfo {
		let regex = util.format("^(.+?)[.](%s)([.].+?)$", validValues.join("|"));
		let parsed = filePath.match(new RegExp(regex, "i"));
		if (parsed) {
			return {
				filePath: filePath,
				onDeviceFileName: path.basename(parsed[1] + parsed[3]),
				shouldIncludeFile: parsed[2].toLowerCase() === value.toLowerCase()
			};
		}

		return null;
	}
}
