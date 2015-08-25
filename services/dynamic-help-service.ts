///<reference path="../.d.ts"/>
"use strict";

import * as os from "os";

export class DynamicHelpService implements IDynamicHelpService {
	constructor(private $dynamicHelpProvider: IDynamicHelpProvider) { }

	public isProjectType(...args: string[]): IFuture<boolean> {
		return this.$dynamicHelpProvider.isProjectType(args);
	}

	public isPlatform(...args: string[]): boolean {
		let platform = os.platform().toLowerCase();
		return _.any(args, arg => arg.toLowerCase() === platform);
	}

	public getLocalVariables(options: { isHtml: boolean }): IFuture<IDictionary<any>> {
		return ((): IDictionary<any> => {
			let isHtml = options.isHtml;
			//in html help we want to show all help. Only CONSOLE specific help(wrapped in if(isConsole) ) must be omitted
			let localVariables = this.$dynamicHelpProvider.getLocalVariables(options).wait();
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
