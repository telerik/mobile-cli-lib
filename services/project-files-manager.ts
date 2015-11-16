///<reference path="../.d.ts"/>
"use strict";

import minimatch = require("minimatch");
import * as path from "path";
import * as util from "util";

interface IProjectFileInfo {
	filePath: string;
	onDeviceFileName: string;
	shouldIncludeFile: boolean;
}

export class ProjectFilesManager implements IProjectFilesManager {
	constructor(private $deviceAppDataFactory: Mobile.IDeviceAppDataFactory,
		private $fs: IFileSystem,
		private $localToDevicePathDataFactory: Mobile.ILocalToDevicePathDataFactory,
		private $mobileHelper: Mobile.IMobileHelper,
		private $projectFilesProvider: IProjectFilesProvider) { }

	public getProjectFiles(projectFilesPath: string): string[] {
		return this.$fs.enumerateFilesInDirectorySync(projectFilesPath, (filePath, stat) => !this.isFileExcluded(path.relative(projectFilesPath, filePath)), { enumerateDirectories: true });
	}

	public isFileExcluded(filePath: string): boolean {
		let exclusionList = this.$projectFilesProvider.excludedProjectDirsAndFiles;
		return !!_.find(exclusionList, (pattern) => minimatch(filePath, pattern, { nocase: true }));
	}

	public createLocalToDevicePaths(platform: string, appIdentifier: string, projectFilesPath: string, files?: string[]): Mobile.ILocalToDevicePathData[] {
		files = files || this.getProjectFiles(projectFilesPath);
		let deviceAppData =  this.$deviceAppDataFactory.create(appIdentifier, this.$mobileHelper.normalizePlatformName(platform));
		let localToDevicePaths = _(files)
			.map(projectFile => this.getProjectFileInfo(projectFile, platform))
			.filter(projectFileInfo => projectFileInfo.shouldIncludeFile)
			.map(projectFileInfo => this.$localToDevicePathDataFactory.create(projectFileInfo.filePath, projectFilesPath, projectFileInfo.onDeviceFileName, deviceAppData.deviceProjectRootPath))
			.value();

		return localToDevicePaths;
	}

	public processPlatformSpecificFiles(directoryPath: string, platform: string, excludedDirs?: string[]): IFuture<void> {
		return (() => {
			let contents = this.$fs.readDirectory(directoryPath).wait();
			let files: string[] = [];

			_.each(contents, fileName => {
				let filePath = path.join(directoryPath, fileName);
				let fsStat = this.$fs.getFsStats(filePath).wait();
				if(fsStat.isDirectory() && !_.contains(excludedDirs, fileName)) {
					this.processPlatformSpecificFilesCore(platform, this.$fs.enumerateFilesInDirectorySync(filePath)).wait();
				} else if(fsStat.isFile()) {
					files.push(filePath);
				}
			});
			this.processPlatformSpecificFilesCore(platform, files).wait();

		}).future<void>()();
	}

	private processPlatformSpecificFilesCore(platform: string, files: string[]): IFuture<void> {
		// Renames the files that have `platform` as substring and removes the files from other platform
		return (() => {
			_.each(files, filePath => {
				let projectFileInfo = this.getProjectFileInfo(filePath, platform);
				if (!projectFileInfo.shouldIncludeFile) {
					this.$fs.deleteFile(filePath).wait();
				} else if (projectFileInfo.onDeviceFileName) {
					this.$fs.rename(filePath, path.join(path.dirname(filePath), projectFileInfo.onDeviceFileName)).wait();
				}
			});
		}).future<void>()();
	}

	private getProjectFileInfo(filePath: string, platform: string): IProjectFileInfo {
		let parsed = this.parseFile(filePath, this.$mobileHelper.platformNames, platform);
		if (!parsed) {
			parsed = this.parseFile(filePath, ["debug", "release"], "debug");
		}

		return parsed || {
			filePath: filePath,
			onDeviceFileName: path.basename(filePath),
			shouldIncludeFile: true
		};
	}

	private parseFile(filePath: string, validValues: string[], value: string): any {
		let regex = util.format("^(.+?)[.](%s)([.].+?)$", validValues.join("|"));
		let parsed = filePath.match(new RegExp(regex, "i"));
		if (parsed) {
			return {
				filePath: filePath,
				onDeviceFileName: path.basename(parsed[1] + parsed[3]),
				shouldIncludeFile: parsed[2].toLowerCase() === value.toLowerCase(),
				value: value
			};
		}

		return undefined;
	}
}
$injector.register("projectFilesManager", ProjectFilesManager);
