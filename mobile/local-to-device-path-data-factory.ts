///<reference path="../.d.ts"/>
"use strict";
import * as helpers from "../helpers";
import * as path from "path";

export class LocalToDevicePathData implements Mobile.ILocalToDevicePathData {
	private devicePath: string;
	private relativeToProjectBasePath: string;
	
	constructor(private fileName: string, private localProjectRootPath: string, private onDeviceFileName: string, private deviceProjectRootPath: string) { }

	public getLocalPath(): string {
		return this.fileName;
	}
	
	public getDevicePath(): string { 
		if(!this.devicePath) {
			let devicePath = path.join(this.deviceProjectRootPath, this.getRelativeToProjectBasePath());
			this.devicePath = helpers.fromWindowsRelativePathToUnix(devicePath);
		}
			
		return this.devicePath; 
	}
	
	public getRelativeToProjectBasePath(): string {
		 if(!this.relativeToProjectBasePath) {
			 this.relativeToProjectBasePath = helpers.getRelativeToRootPath(this.localProjectRootPath, this.onDeviceFileName);
		 }
		 
		 return this.relativeToProjectBasePath;
	}
}

export class LocalToDevicePathDataFactory implements Mobile.ILocalToDevicePathDataFactory {
	create(fileName: string, localProjectRootPath: string, onDeviceFileName: string, deviceProjectRootPath: string):  Mobile.ILocalToDevicePathData {
		return new LocalToDevicePathData(fileName, localProjectRootPath, onDeviceFileName, deviceProjectRootPath);
	}
}
$injector.register("localToDevicePathDataFactory", LocalToDevicePathDataFactory);
