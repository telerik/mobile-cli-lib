///<reference path="../.d.ts"/>
"use strict";

import decoratorsLib = require("../../decorators");
import yokLib = require("../../yok");
import {assert} from "chai";
import Future = require("fibers/future");

let originalInjector:any = {};
_.extend(originalInjector, $injector);

describe("decorators", () => {
	afterEach(() => {
		$injector = originalInjector;
		// Due to bug in lodash's extend method, manually set publicApi to the initial object.
		$injector.publicApi = {__modules__: {}};
	});

	describe("exportedPromise", () => {
		it("returns function", () => {
			let result: any = decoratorsLib.exportedPromise("test");
			assert.equal(typeof(result), "function");
		});

		it("does not change original method", () => {
			let promisifiedResult: any = decoratorsLib.exportedPromise("moduleName");
			let expectedResult = {"originalObject": "originalValue"};
			let actualResult = promisifiedResult({}, "myTest1", expectedResult);
			assert.deepEqual(actualResult, expectedResult);
		});

		it("adds method to public api", () => {
			assert.deepEqual($injector.publicApi.__modules__["moduleName"], undefined);
			let promisifiedResult: any = decoratorsLib.exportedPromise("moduleName");
			/* actualResult is */ promisifiedResult({}, "propertyName", {});
			assert.deepEqual(typeof($injector.publicApi.__modules__["moduleName"]["propertyName"]), "function");
		});

		it("returns Promise", () => {
			$injector = new yokLib.Yok();
			let expectedResult = "result";
			$injector.register("moduleName", {propertyName: () => {return expectedResult;}});
			assert.deepEqual($injector.publicApi.__modules__["moduleName"], undefined);
			let promisifiedResultFunction: any = decoratorsLib.exportedPromise("moduleName");
			// Call this line in order to generate publicApi and get the real Promise
			promisifiedResultFunction({}, "propertyName", {});
			let promise: any = $injector.publicApi.__modules__["moduleName"]["propertyName"]();
			assert.equal(typeof(promise.then), "function");
			promise.then((val: string) => {
				assert.deepEqual(val, expectedResult);
			});
		});

		it("returns Promise, which is resolved to correct value (function without arguments)", () => {
			$injector = new yokLib.Yok();
			let expectedResult = "result";
			$injector.register("moduleName", {propertyName: () => {return expectedResult;}});
			let promisifiedResultFunction: any = decoratorsLib.exportedPromise("moduleName");
			// Call this line in order to generate publicApi and get the real Promise
			promisifiedResultFunction({}, "propertyName", {});
			let promise: any = $injector.publicApi.__modules__["moduleName"]["propertyName"]();
			promise.then((val: string) => {
				assert.deepEqual(val, expectedResult);
			});
		});

		it("returns Promise, which is resolved to correct value (function with arguments)", () => {
			$injector = new yokLib.Yok();
			let expectedArgs = ["result", "result1", "result2"];
			$injector.register("moduleName", {propertyName: (functionArgs: string[]) => {return functionArgs;}});
			let promisifiedResultFunction: any = decoratorsLib.exportedPromise("moduleName");
			// Call this line in order to generate publicApi and get the real Promise
			promisifiedResultFunction({}, "propertyName", {});
			let promise: any = $injector.publicApi.__modules__["moduleName"]["propertyName"](expectedArgs);
			promise.then((val: string[]) => {
				assert.deepEqual(val, expectedArgs);
			});
		});

		it("returns Promise, which is resolved to correct value (function returning IFuture without arguments)", () => {
			$injector = new yokLib.Yok();
			let expectedResult = "result";
			$injector.register("moduleName", {propertyName: () => Future.fromResult(expectedResult)});
			let promisifiedResultFunction: any = decoratorsLib.exportedPromise("moduleName");
			// Call this line in order to generate publicApi and get the real Promise
			promisifiedResultFunction({}, "propertyName", {});
			let promise: any = $injector.publicApi.__modules__["moduleName"]["propertyName"]();
			promise.then((val: string) => {
				assert.deepEqual(val, expectedResult);
			});
		});

		it("returns Promise, which is resolved to correct value (function returning IFuture with arguments)", () => {
			$injector = new yokLib.Yok();
			let expectedArgs = ["result", "result1", "result2"];
			$injector.register("moduleName", {propertyName: (args: string[]) => Future.fromResult(args)});
			let promisifiedResultFunction: any = decoratorsLib.exportedPromise("moduleName");
			// Call this line in order to generate publicApi and get the real Promise
			promisifiedResultFunction({}, "propertyName", {});
			let promise: any = $injector.publicApi.__modules__["moduleName"]["propertyName"](expectedArgs);
			promise.then((val: string[]) => {
				assert.deepEqual(val, expectedArgs);
			});
		});

		it("rejects Promise, which is resolved to correct error (function without arguments throws)", () => {
			$injector = new yokLib.Yok();
			let expectedError = new Error("Test msg");
			$injector.register("moduleName", {propertyName: () => {throw expectedError;}});
			let promisifiedResultFunction: any = decoratorsLib.exportedPromise("moduleName");
			// Call this line in order to generate publicApi and get the real Promise
			promisifiedResultFunction({}, "propertyName", {});
			let promise: any = $injector.publicApi.__modules__["moduleName"]["propertyName"]();
			promise.then((result: any) => {
					throw new Error("Then method MUST not be called when promise is rejected!");
				}, (err: Error) => {
					assert.deepEqual(err, expectedError);
				});
		});

		it("rejects Promise, which is resolved to correct error (function returning IFuture without arguments throws)", () => {
			$injector = new yokLib.Yok();
			let expectedError = new Error("Test msg");
			$injector.register("moduleName", {propertyName: () => { return (() => { throw expectedError; }).future<void>()(); }});
			let promisifiedResultFunction: any = decoratorsLib.exportedPromise("moduleName");
			// Call this line in order to generate publicApi and get the real Promise
			promisifiedResultFunction({}, "propertyName", {});
			let promise: any = $injector.publicApi.__modules__["moduleName"]["propertyName"]();
			promise.then((result: any) => {
					throw new Error("Then method MUST not be called when promise is rejected!");
				}, (err: Error) => {
					// We cannot compare promise.reason() with error directly as node-fibers modify the error.stack property, so deepEqual method fails.
					assert.deepEqual(err.message, expectedError.message);
				});
		});

		it("returns Promises, which are resolved to correct value (function returning IFuture<T>[] without arguments)", () => {
			$injector = new yokLib.Yok();
			let expectedResults = ["result1", "result2", "result3"];
			$injector.register("moduleName", { propertyName: () => _.map(expectedResults, expectedResult => Future.fromResult(expectedResult)) });
			let promisifiedResultFunction: any = decoratorsLib.exportedPromise("moduleName");
			// Call this line in order to generate publicApi and get the real Promises
			promisifiedResultFunction({}, "propertyName", {});
			let promises: Promise<string>[] = $injector.publicApi.__modules__["moduleName"]["propertyName"]();
			_.each(promises, (promise, index) => promise.then((val: string) => {
				assert.deepEqual(val, expectedResults[index]);
			}));
		});

		it("rejects Promises, which are resolved to correct error (function returning IFuture<T>[] without arguments throws)", () => {
			$injector = new yokLib.Yok();
			let expectedErrors = [new Error("result1"), new Error("result2"), new Error("result3")];
			$injector.register("moduleName", { propertyName: () => _.map(expectedErrors, expectedError => { return (() => { throw expectedError; }).future<void>()(); })});
			let promisifiedResultFunction: any = decoratorsLib.exportedPromise("moduleName");
			// Call this line in order to generate publicApi and get the real Promises
			promisifiedResultFunction({}, "propertyName", {});
			let promises: Promise<string>[] = $injector.publicApi.__modules__["moduleName"]["propertyName"]();
			_.each(promises, (promise, index) => promise.then((result: any) => {
					throw new Error("Then method MUST not be called when promise is rejected!");
				}, (err: Error) => {
					// We cannot compare promise.reason() with error directly as node-fibers modify the error.stack property, so deepEqual method fails.
					assert.deepEqual(err.message, expectedErrors[index].message);
				}));
		});

		it("rejects only Promises which throw, resolves the others correctly (function returning IFuture<T>[] without arguments)", () => {
			$injector = new yokLib.Yok();
			let expectedResults: any[] = ["result1", new Error("result2")];
			$injector.register("moduleName", { propertyName: () => _.map(expectedResults, expectedResult => Future.fromResult(expectedResult)) });
			let promisifiedResultFunction: any = decoratorsLib.exportedPromise("moduleName");
			// Call this line in order to generate publicApi and get the real Promises
			promisifiedResultFunction({}, "propertyName", {});
			let promises: Promise<string>[] = $injector.publicApi.__modules__["moduleName"]["propertyName"]();
			_.each(promises, (promise, index) => promise.then((val: string) => {
				assert.deepEqual(val, expectedResults[index]);
			}, (err: Error) => {
				// We cannot compare promise.reason() with error directly as node-fibers modify the error.stack property, so deepEqual method fails.
				assert.deepEqual(err.message, expectedResults[index].message);
			}));
		});
	});
});
