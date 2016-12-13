import minimatch = require("minimatch");
import * as path from "path";
import * as util from "util";

export class ProjectFilesManager implements IProjectFilesManager {
	constructor(private $fs: IFileSystem,
		private $localToDevicePathDataFactory: Mobile.ILocalToDevicePathDataFactory,
		private $logger: ILogger,
		private $mobileHelper: Mobile.IMobileHelper,
		private $projectFilesProvider: IProjectFilesProvider) { }

	public getProjectFiles(projectFilesPath: string, excludedProjectDirsAndFiles?: string[], filter?: (filePath: string, stat: IFsStats) => boolean, opts?: any): string[] {
		let projectFiles = this.$fs.enumerateFilesInDirectorySync(projectFilesPath, (filePath, stat) => {
			let isFileExcluded = this.isFileExcluded(path.relative(projectFilesPath, filePath));
			let isFileFiltered = filter ? filter(filePath, stat) : false;
			return !isFileExcluded && !isFileFiltered;
		}, opts);

		this.$logger.trace("enumerateProjectFiles: %s", util.inspect(projectFiles));

		return projectFiles;
	}

	public isFileExcluded(filePath: string, excludedProjectDirsAndFiles?: string[]): boolean {
		let isInExcludedList = !!_.find(excludedProjectDirsAndFiles, (pattern) => minimatch(filePath, pattern, { nocase: true }));
		return isInExcludedList || this.$projectFilesProvider.isFileExcluded(filePath);
	}

	public createLocalToDevicePaths(deviceAppData: Mobile.IDeviceAppData, projectFilesPath: string, files: string[], excludedProjectDirsAndFiles: string[], projectFilesConfig?: IProjectFilesConfig): Mobile.ILocalToDevicePathData[] {
		files = files || this.getProjectFiles(projectFilesPath, excludedProjectDirsAndFiles, null, { enumerateDirectories: true });
		let localToDevicePaths = files
			.map(projectFile => this.$projectFilesProvider.getProjectFileInfo(projectFile, deviceAppData.platform, projectFilesConfig))
			.filter(projectFileInfo => projectFileInfo.shouldIncludeFile)
			.map(projectFileInfo => this.$localToDevicePathDataFactory.create(projectFileInfo.filePath, projectFilesPath, projectFileInfo.onDeviceFileName, deviceAppData.deviceProjectRootPath));

		return localToDevicePaths;
	}

	public processPlatformSpecificFiles(directoryPath: string, platform: string, excludedDirs?: string[]): void {
		let contents = this.$fs.readDirectory(directoryPath);
		let files: string[] = [];

		_.each(contents, fileName => {
			let filePath = path.join(directoryPath, fileName);
			let fsStat = this.$fs.getFsStats(filePath);
			if (fsStat.isDirectory() && !_.includes(excludedDirs, fileName)) {
				this.processPlatformSpecificFilesCore(platform, this.$fs.enumerateFilesInDirectorySync(filePath));
			} else if (fsStat.isFile()) {
				files.push(filePath);
			}
		});

		this.processPlatformSpecificFilesCore(platform, files);
	}

	private processPlatformSpecificFilesCore(platform: string, files: string[]): void {
		// Renames the files that have `platform` as substring and removes the files from other platform
		_.each(files, filePath => {
			let projectFileInfo = this.$projectFilesProvider.getProjectFileInfo(filePath, platform);
			if (!projectFileInfo.shouldIncludeFile) {
				this.$fs.deleteFile(filePath);
			} else if (projectFileInfo.onDeviceFileName) {
				let onDeviceFilePath = path.join(path.dirname(filePath), projectFileInfo.onDeviceFileName);

				// Fix .js.map entries
				let extension = path.extname(projectFileInfo.onDeviceFileName);
				if (onDeviceFilePath !== filePath) {
					if (extension === ".js" || extension === ".map") {
						let oldName = extension === ".map" ? this.getFileName(filePath, extension) : path.basename(filePath);
						let newName = extension === ".map" ? this.getFileName(projectFileInfo.onDeviceFileName, extension) : path.basename(projectFileInfo.onDeviceFileName);

						let fileContent = this.$fs.readText(filePath);
						fileContent = fileContent.replace(new RegExp(oldName, 'g'), newName);
						this.$fs.writeFile(filePath, fileContent);
					}
					// Rename the file
					this.$fs.rename(filePath, onDeviceFilePath);
				}
			}
		});
	}

	private getFileName(filePath: string, extension: string): string {
		return path.basename(filePath.replace(extension === ".map" ? ".js.map" : ".js", ""));
	}
}
$injector.register("projectFilesManager", ProjectFilesManager);
