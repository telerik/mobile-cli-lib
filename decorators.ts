import * as assert from "assert";
import { isFuture } from "./helpers";

export function cache(): any {
	return (target: Object, propertyKey: string, descriptor: TypedPropertyDescriptor<any>, a: any): TypedPropertyDescriptor<any> => {
		let isCalled = false;
		let result: any;
		let propName: string = descriptor.value ? "value" : "get";

		const originalValue = (<any>descriptor)[propName];

		(<any>descriptor)[propName] = (...args: any[]) => {
			if (!isCalled) {
				isCalled = true;
				result = originalValue.apply(target, args);
			}

			return result;
		};

		return descriptor;
	};
}

export function invokeBefore(methodName: string, methodArgs?: any[]): any {
	return (target: Object, propertyKey: string, descriptor: TypedPropertyDescriptor<any>, a: any): TypedPropertyDescriptor<any> => {
		const originalValue = descriptor.value;
		descriptor.value = async (...args: any[]) => {
			await target[methodName].apply(target, methodArgs);
			return originalValue.apply(target, args);
		};

		return descriptor;
	};
}

export function invokeInit(): any {
	return invokeBefore("init");
}

export function exportedPromise(moduleName: string, postAction?: () => void): any {
	return (target: Object, propertyKey: string, descriptor: TypedPropertyDescriptor<any>): TypedPropertyDescriptor<any> => {
		$injector.publicApi.__modules__[moduleName] = $injector.publicApi.__modules__[moduleName] || {};
		$injector.publicApi.__modules__[moduleName][propertyKey] = (...args: any[]): Promise<any>[] | Promise<any> => {
			let originalModule = $injector.resolve(moduleName);
			let originalMethod: Function = originalModule[propertyKey];
			let result: any;
			try {
				result = originalMethod.apply(originalModule, args);
			} catch (err) {
				let promise = new Promise((onFulfilled: Function, onRejected: Function) => {
					onRejected(err);
				});

				return promise;
			}

			let types = _(result)
				.groupBy((f: any) => typeof f)
				.keys()
				.value(),
				postActionMethod = postAction && postAction.bind(originalModule);

			// Check if method returns Promise<T>[]. In this case we will return Promise<T>[]
			if (_.isArray(result) && types.length === 1 && isFuture(_.first<any>(result))) {
				return _.map(result, (future: Promise<any>, index: number) => getPromise(future,
					{
						postActionMethod,
						shouldExecutePostAction: (index + 1) === result.length
					}));
			} else {
				return getPromise(result,
					{
						postActionMethod,
						shouldExecutePostAction: !!postAction
					});
			}
		};

		return descriptor;
	};
}

function getPromise(originalValue: any, config?: { postActionMethod: () => void, shouldExecutePostAction?: boolean }): Promise<any> {
	let postAction = (data: any) => {
		if (config && config.postActionMethod && config.shouldExecutePostAction) {
			config.postActionMethod();
		}

		if (data instanceof Error) {
			throw data;
		}

		return data;
	};

	return new Promise(async (onFulfilled: Function, onRejected: Function) => {
		if (isFuture(originalValue)) {
			try {
				let realResult = await originalValue;
				onFulfilled(realResult);
			} catch (err) {
				onRejected(err);
			}
		} else {
			onFulfilled(originalValue);
		}
	}).then(postAction, postAction);
}

export function exported(moduleName: string): any {
	return (target: Object, propertyKey: string, descriptor: TypedPropertyDescriptor<any>): TypedPropertyDescriptor<any> => {
		$injector.publicApi.__modules__[moduleName] = $injector.publicApi.__modules__[moduleName] || {};
		$injector.publicApi.__modules__[moduleName][propertyKey] = (...args: any[]): any => {
			let originalModule = $injector.resolve(moduleName),
				originalMethod: any = originalModule[propertyKey],
				result = originalMethod.apply(originalModule, args);

			assert.strictEqual(isFuture(result), false, "Cannot use exported decorator with function returning Promise<T>.");
			return result;
		};

		return descriptor;
	};
}
