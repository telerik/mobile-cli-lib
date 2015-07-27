///<reference path="../.d.ts"/>
"use strict";

import decoratorsLib = require("../../decorators");
import yokLib = require("../../yok");
import chai = require("chai");
import Promise = require("bluebird");
import Future = require("fibers/future");

let originalInjector:any = {}
_.extend(originalInjector, $injector);
let assert: chai.Assert = chai.assert;

describe("decorators", () => {
	afterEach(() => {
		$injector = originalInjector;
		// Due to bug in lodash's extend method, manually set publicApi to the initial object.
		$injector.publicApi = {__modules__: {}};
	});

	describe("exported", () => {
		it("returns function", () => {
			let result: any = decoratorsLib.exported("test");
			assert.equal(typeof(result), "function");
		});

		it("does not change original method", () => {
			let testInjector = new yokLib.Yok();
			let promisifiedResult: any = decoratorsLib.exported("moduleName");
			let expectedResult = {"originalObject": "originalValue"};
			let actualResult = promisifiedResult({}, "myTest1", expectedResult);
			assert.deepEqual(actualResult, expectedResult);
		});

		it("adds method to public api", () => {
			let testInjector = new yokLib.Yok();
			assert.deepEqual($injector.publicApi.__modules__["moduleName"], undefined);
			let promisifiedResult: any = decoratorsLib.exported("moduleName");
			let actualResult = promisifiedResult({}, "propertyName", {});
			assert.deepEqual(typeof($injector.publicApi.__modules__["moduleName"]["propertyName"]), "function");
		});

		it("returns Promise", () => {
			$injector = new yokLib.Yok();
			let result = "result";
			$injector.register("moduleName", {propertyName: () => {return result;}});
			assert.deepEqual($injector.publicApi.__modules__["moduleName"], undefined);
			let promisifiedResultFunction: any = decoratorsLib.exported("moduleName");
			// Call this line in order to generate publicApi and get the real Promise
			promisifiedResultFunction({}, "propertyName", {});
			let promise: any = $injector.publicApi.__modules__["moduleName"]["propertyName"]();
			assert.equal(typeof(promise.then), "function");
			assert.equal(typeof(promise.catch), "function");
			assert.deepEqual(promise.value(), result);
		});

		it("returns Promise, which is resolved to correct value (function without arguments)", () => {
			$injector = new yokLib.Yok();
			let result = "result";
			$injector.register("moduleName", {propertyName: () => {return result;}});
			let promisifiedResultFunction: any = decoratorsLib.exported("moduleName");
			// Call this line in order to generate publicApi and get the real Promise
			promisifiedResultFunction({}, "propertyName", {});
			let promise: any = $injector.publicApi.__modules__["moduleName"]["propertyName"]();
			assert.deepEqual(promise.value(), result);
		});

		it("returns Promise, which is resolved to correct value (function with arguments)", () => {
			$injector = new yokLib.Yok();
			let expectedArgs = ["result", "result1", "result2"];
			$injector.register("moduleName", {propertyName: (functionArgs: string[]) => {return functionArgs;}});
			let promisifiedResultFunction: any = decoratorsLib.exported("moduleName");
			// Call this line in order to generate publicApi and get the real Promise
			promisifiedResultFunction({}, "propertyName", {});
			let promise: any = $injector.publicApi.__modules__["moduleName"]["propertyName"](expectedArgs);
			assert.deepEqual(promise.value(), expectedArgs);
		});

		it("returns Promise, which is resolved to correct value (function returning IFuture without arguments)", () => {
			$injector = new yokLib.Yok();
			let result = "result";
			$injector.register("moduleName", {propertyName: () => Future.fromResult(result)});
			let promisifiedResultFunction: any = decoratorsLib.exported("moduleName");
			// Call this line in order to generate publicApi and get the real Promise
			promisifiedResultFunction({}, "propertyName", {});
			let promise: any = $injector.publicApi.__modules__["moduleName"]["propertyName"]();
			assert.deepEqual(promise.value(), result);
		});

		it("returns Promise, which is resolved to correct value (function returning IFuture with arguments)", () => {
			$injector = new yokLib.Yok();
			let expectedArgs = ["result", "result1", "result2"];
			$injector.register("moduleName", {propertyName: (args: string[]) => Future.fromResult(args)});
			let promisifiedResultFunction: any = decoratorsLib.exported("moduleName");
			// Call this line in order to generate publicApi and get the real Promise
			promisifiedResultFunction({}, "propertyName", {});
			let promise: any = $injector.publicApi.__modules__["moduleName"]["propertyName"](expectedArgs);
			assert.deepEqual(promise.value(), expectedArgs);
		});
	});
});
