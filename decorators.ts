import * as fiberBootstrap from "./fiber-bootstrap";
import * as assert from "assert";
import {isFuture} from "./helpers";

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

			// Check if method returns IFuture<T>[]. In this case we will return Promise<T>[]
			if (_.isArray(result) && types.length === 1 && isFuture(_.first<any>(result))) {
				return _.map(result, (future: IFuture<any>, index: number) => getPromise(future,
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

	return new Promise((onFulfilled: Function, onRejected: Function) => {
		if (isFuture(originalValue)) {
			fiberBootstrap.run(function () {
				try {
					let realResult = originalValue.wait();
					onFulfilled(realResult);
				} catch (err) {
					onRejected(err);
				}
			});
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

			assert.strictEqual(isFuture(result), false, "Cannot use exported decorator with function returning IFuture<T>.");
			return result;
		};

		return descriptor;
	};
}
