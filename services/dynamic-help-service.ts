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

	public getLocalVariables(options: { isHtml: boolean }): IFuture<IDictionary<any>> {
		return ((): IDictionary<any> => {
			var isHtml = options.isHtml;
			//in html help we want to show all help. Only CONSOLE specific help(wrapped in if(isConsole) ) must be omitted
			var localVariables = this.$dynamicHelpProvider.getLocalVariables(options).wait();
			localVariables["isLinux"] = isHtml || this.isPlatform("linux");
			localVariables["isWindows"] = isHtml || this.isPlatform("win32");
			localVariables["isMacOS"] = isHtml || this.isPlatform("darwin");
			localVariables["isConsole"] = !isHtml;
			localVariables["isHtml"] = isHtml;

			return localVariables;
		}).future<IDictionary<any>>()();
	}
}
$injector.register("dynamicHelpService", DynamicHelpService);