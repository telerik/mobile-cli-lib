///<reference path=".d.ts"/>
"use strict";

import * as Promise from "bluebird";
import * as fiberBootstrap from "./fiber-bootstrap";
import * as assert from "assert";
import {isFuture} from "./helpers";

export function exportedPromise(moduleName: string): any {
	return (target: Object, propertyKey: string, descriptor: TypedPropertyDescriptor<any>): TypedPropertyDescriptor<any> => {
		$injector.publicApi.__modules__[moduleName] = $injector.publicApi.__modules__[moduleName] || {};
		$injector.publicApi.__modules__[moduleName][propertyKey] = (...args: any[]): Promise<any>[] | Promise<any>=> {
			let originalModule = $injector.resolve(moduleName);
			let originalMethod: Function = originalModule[propertyKey];
			let result: any;
			try {
				result = originalMethod.apply(originalModule, args);
			} catch(err) {
				let promise = new Promise(function(onFulfilled : Function, onRejected: Function) {
					onRejected(err);
				});

				return promise;
			}

			let types = _(result)
						.groupBy(f => typeof f)
						.keys()
						.value();

			// Check if method returns IFuture<T>[]. In this case we will return Promise<T>[]
			if(_.isArray(result) && types.length === 1 && isFuture(_.first<any>(result))) {
				return _.map(result, (future: IFuture<any>) => getPromise(future));
			} else {
				return getPromise(result);
			}
		};

		return descriptor;
	};
}

function getPromise(originalValue: any): Promise<any> {
	return new Promise(function(onFulfilled : Function, onRejected: Function) {
		if(isFuture(originalValue)) {
			fiberBootstrap.run(function () {
				try {
					let realResult = originalValue.wait();
					onFulfilled(realResult);
				} catch(err) {
					onRejected(err);
				}
			});
		} else {
			onFulfilled(originalValue);
		}
	});
}

export function exported(moduleName: string): any {
	return (target: Object, propertyKey: string, descriptor: TypedPropertyDescriptor<any>): TypedPropertyDescriptor<any> => {
		$injector.publicApi.__modules__[moduleName] = $injector.publicApi.__modules__[moduleName] || {};
		$injector.publicApi.__modules__[moduleName][propertyKey] = (...args: any[]): any => {
			let originalModule = $injector.resolve(moduleName);
			let originalMethod: any = target[propertyKey];
			let result = originalMethod.apply(originalModule, args);
			assert.strictEqual(isFuture(result), false, "Cannot use exported decorator with function returning IFuture<T>.");
			return result;
		};

		return descriptor;
	};
}
