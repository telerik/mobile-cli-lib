///<reference path=".d.ts"/>
"use strict";

import Promise = require("bluebird");
import fiberBootstrap = require("./fiber-bootstrap");

export function promisify(moduleName: string) {
	return (target: Object, propertyKey: string, descriptor: TypedPropertyDescriptor<any>) => {
		$injector._publicApi[moduleName] = $injector._publicApi[moduleName] || {};
		$injector._publicApi[moduleName][propertyKey] =  (...args: any[]): any => {
				return new Promise(function(resolve: any, reject: any) {
						let originalModule = $injector.resolve(moduleName);
						fiberBootstrap.run(function () {
							// TODO: Handle cases when function does not return IFuture
							// TODO: Handle cases when function throws error
							resolve(originalModule[propertyKey].apply(originalModule, args).wait());
						});
					});
			}
		return descriptor;
	}
}
