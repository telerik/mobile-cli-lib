///<reference path=".d.ts"/>
"use strict";

import Promise = require("bluebird");
import fiberBootstrap = require("./fiber-bootstrap");

export function exported(moduleName: string) {
	return (target: Object, propertyKey: string, descriptor: TypedPropertyDescriptor<any>) => {
		$injector.publicApi.__modules__[moduleName] = $injector.publicApi.__modules__[moduleName] || {};
		$injector.publicApi.__modules__[moduleName][propertyKey] =  (...args: any[]): any => {
			return new Promise(function(onFulfilled : Function, onRejected: Function) {
					let originalModule = $injector.resolve(moduleName);
					let originalMethod: Function = originalModule[propertyKey];
					let result: any;
					try {
						result = originalMethod.apply(originalModule, args)
					} catch(err) {
						onRejected(err);
						return;
					}

					if(result && typeof result.wait === "function") {
						fiberBootstrap.run(function () {
							try {
								let realResult = result.wait();
								onFulfilled(realResult);
							} catch(err) {
								onRejected(err);
							}
						});
					} else {
						onFulfilled(result);
					}
				});
		}

		return descriptor;
	}
}
