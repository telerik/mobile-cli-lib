///<reference path="../../.d.ts"/>
"use strict";

import os = require("os");

export class DynamicHelpService implements IDynamicHelpService {
	constructor(private $dynamicHelpProvider: IDynamicHelpProvider) { }
	public isProjectType(...args: string[]): IFuture<boolean> {
		return this.$dynamicHelpProvider.isProjectType(args);
	}

	public isPlatform(...args: string[]): boolean {
		var platform = os.platform().toLowerCase();
		return _.any(args, arg => arg.toLowerCase() === platform);
	}

	public getLocalVariables(): IFuture<IDictionary<any>> {
		return ((): IDictionary<any> => {
			var localVariables = this.$dynamicHelpProvider.getLocalVariables().wait();
			localVariables["isLinux"] = this.isPlatform("linux");
			localVariables["isWindows"] = this.isPlatform("win32");
			localVariables["isMacOS"] = this.isPlatform("darwin");

			return localVariables;
		}).future<IDictionary<any>>()();
	}
}
$injector.register("dynamicHelpService", DynamicHelpService);