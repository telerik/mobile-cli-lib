import * as helpers from "../../helpers";
import { assert } from "chai";
import { EOL } from "os";

interface ITestData {
	input: any;
	expectedResult: any;
	expectedError?: any;
}

describe("helpers", () => {

	const assertTestData = (testData: ITestData, method: Function) => {
		const actualResult = method(testData.input);
		assert.deepEqual(actualResult, testData.expectedResult, `For input ${testData.input}, the expected result is: ${testData.expectedResult}, but actual result is: ${actualResult}.`);
	};

	describe("getPropertyName", () => {
		let ES5Functions: ITestData[] = [
			{
				input: `function (a) {
					return a.test;
				}`,
				expectedResult: "test"
			},
			{
				input: `function(a) {return a.test;}`,
				expectedResult: "test"
			},
			{
				input: null,
				expectedResult: null
			},
			{
				input: "",
				expectedResult: null
			},
			{
				// Not supported scenario.
				// Argument of the function must be object and the function must return one of its properties.
				input: "function(a){ return a; }",
				expectedResult: null
			},
			{
				input: `function(a) {return a.b.test;}`,
				expectedResult: "test"
			},
			{
				input: `function(a) {return a.b.c.d.["test1"].e.f.test;}`,
				expectedResult: "test"
			},
			{
				input: `function(a) {return ;}`,
				expectedResult: null
			},
			{
				input: `function(a) {return undefined;}`,
				expectedResult: null
			},
			{
				input: `function(a) {return null;}`,
				expectedResult: null
			},
			{
				input: `function(a) {return "test";}`,
				expectedResult: null
			}
		];

		let ES6Functions: ITestData[] = [
			{
				input: `(a) => {
					return a.test;
				}`,
				expectedResult: "test"
			},
			{
				input: `(a)=>{return a.test;}`,
				expectedResult: "test"
			},
			{
				input: `a => a.test`,
				expectedResult: "test"
			},
			{
				input: `(a) => a.test`,
				expectedResult: "test"
			},
			{
				input: `(a)     =>    a.test      `,
				expectedResult: "test"
			},
			{
				input: `(a)=>a.test       `,
				expectedResult: "test"
			},
			{
				input: null,
				expectedResult: null
			},
			{
				input: "",
				expectedResult: null
			},
			{
				// Not supported scenario.
				// Argument of the function must be object and the function must return one of its properties.
				input: "a => a",
				expectedResult: null
			},
			{
				input: `(a) => a.b.test`,
				expectedResult: "test"
			},
			{
				input: `(a) => { return a.b.test; }`,
				expectedResult: "test"
			},
			{
				input: `a => a.b.c.d.["test1"].e.f.test`,
				expectedResult: "test"
			},
			{
				input: `(a) => {return ;}`,
				expectedResult: null
			},
			{
				input: `a => undefined `,
				expectedResult: null
			},
			{
				input: `a => null`,
				expectedResult: null
			},
			{
				input: `a => "test"`,
				expectedResult: null
			},
			{
				input: (a: any) => a.test,
				expectedResult: "test"
			}
		];

		// getPropertyName accepts function as argument.
		// The tests will use strings in order to skip transpilation of lambdas to functions.
		it("returns correct property name for ES5 functions", () => {
			_.each(ES5Functions, testData => assertTestData(testData, helpers.getPropertyName));
		});

		it("returns correct property name for ES6 functions", () => {
			_.each(ES6Functions, testData => assertTestData(testData, helpers.getPropertyName));
		});
	});

	describe("toBoolean", () => {
		let toBooleanTestData: ITestData[] = [
			{
				input: true,
				expectedResult: true
			},
			{
				input: false,
				expectedResult: false
			},
			{
				input: "true",
				expectedResult: true
			},
			{
				input: "false",
				expectedResult: false
			},
			{
				input: "",
				expectedResult: false
			},
			{
				input: null,
				expectedResult: false
			},
			{
				input: undefined,
				expectedResult: false
			},
			{
				input: '\n',
				expectedResult: false
			},
			{
				input: '\r\n',
				expectedResult: false
			},
			{
				input: '\t',
				expectedResult: false
			},
			{
				input: '\t\t\t\t\t\t\n\t\t\t\t\r\n\r\n\n\n   \t\t\t\r\n',
				expectedResult: false
			},
			{
				input: "some random text",
				expectedResult: false
			},
			{
				input: { "true": true },
				expectedResult: false
			},
			{
				input: {},
				expectedResult: false
			},
			{
				input: { "a": { "b": 1 } },
				expectedResult: false
			}
		];

		it("returns expected result", () => {
			_.each(toBooleanTestData, testData => assertTestData(testData, helpers.toBoolean));
		});

		it("returns false when Object.create(null) is passed", () => {
			let actualResult = helpers.toBoolean(Object.create(null));
			assert.deepEqual(actualResult, false);
		});
	});

	describe("isNullOrWhitespace", () => {
		let isNullOrWhitespaceTestData: ITestData[] = [
			{
				input: "",
				expectedResult: true
			},
			{
				input: "     ",
				expectedResult: true
			},
			{
				input: null,
				expectedResult: true
			},
			{
				input: undefined,
				expectedResult: true
			},
			{
				input: [],
				expectedResult: false
			},
			{
				input: ["test1", "test2"],
				expectedResult: false
			},
			{
				input: {},
				expectedResult: false
			},
			{
				input: { a: 1, b: 2 },
				expectedResult: false
			},
			{
				input: true,
				expectedResult: false
			},
			{
				input: false,
				expectedResult: false
			},
			{
				input: '\n',
				expectedResult: true
			},
			{
				input: '\r\n',
				expectedResult: true
			},
			{
				input: '\t',
				expectedResult: true
			},
			{
				input: '\t\t\t\t\t\t\r\n\t\t\t\t\t\n\t\t\t     \t\t\t\t\t\n\r\n   ',
				expectedResult: true
			}
		];

		it("returns expected result", () => {
			_.each(isNullOrWhitespaceTestData, t => assertTestData(t, helpers.isNullOrWhitespace));
		});

		it("returns false when Object.create(null) is passed", () => {
			let actualResult = helpers.isNullOrWhitespace(Object.create(null));
			assert.deepEqual(actualResult, false);
		});
	});

	describe("settlePromises<T>", () => {
		const getErrorMessage = (messages: any[]): string => {
			return `Multiple errors were thrown:${EOL}${messages.join(EOL)}`;
		};

		const getRejectedPromise = (errorMessage: any): Promise<any> => {
			let promise = Promise.reject(errorMessage);
			promise.catch(() => {
				// the handler is here in order to prevent warnings in Node 7+
				// PromiseRejectionHandledWarning: Promise rejection was handled asynchronously
				// Check the link for more details: https://stackoverflow.com/questions/40920179/should-i-refrain-from-handling-promise-rejection-asynchronously/40921505
			});

			return promise;
		};

		const settlePromisesTestData: ITestData[] = [
			{
				input: [Promise.resolve(1)],
				expectedResult: [1]
			},
			{
				input: [Promise.resolve(1), Promise.resolve(2)],
				expectedResult: [1, 2]
			},
			{
				input: [Promise.resolve(1), Promise.resolve(2), Promise.resolve(3), Promise.resolve(4), Promise.resolve(5)],
				expectedResult: [1, 2, 3, 4, 5]
			},
			{
				input: [Promise.resolve(1), getRejectedPromise(2)],
				expectedResult: null,
				expectedError: getErrorMessage([2])
			},
			{
				input: [getRejectedPromise(1), Promise.resolve(2)],
				expectedResult: null,
				expectedError: getErrorMessage([1])
			},
			{
				input: [Promise.resolve(1), getRejectedPromise(2), Promise.resolve(3), getRejectedPromise(new Error("4"))],
				expectedResult: null,
				expectedError: getErrorMessage([2, 4])
			}
		];

		_.each(settlePromisesTestData, (testData, inputNumber) => {
			it(`returns correct data, test case ${inputNumber}`, (done: mocha.Done) => {
				const invokeDoneCallback = () => done();
				helpers.settlePromises<any>(testData.input)
					.then(res => {
						assert.deepEqual(res, testData.expectedResult);
					}, err => {
						assert.deepEqual(err.message, testData.expectedError);
					})
					.then(invokeDoneCallback, invokeDoneCallback);
			});
		});

		it("executes all promises even when some of them are rejected", (done: mocha.Done) => {
			let isPromiseSettled = false;

			const testData: ITestData = {
				input: [getRejectedPromise(1), Promise.resolve(2).then(() => isPromiseSettled = true)],
				expectedResult: null,
				expectedError: getErrorMessage([1])
			};

			helpers.settlePromises<any>(testData.input)
				.then(res => {
					assert.deepEqual(res, testData.expectedResult);
				}, err => {
					assert.deepEqual(err.message, testData.expectedError);
				})
				.then(() => {
					assert.isTrue(isPromiseSettled, "When the first promise is rejected, the second one should still be executed.");
					done();
				})
				.catch(done);
		});
	});

	describe("getPidFromiOSSimulatorLogs", () => {
		interface IiOSSimulatorPidTestData extends ITestData {
			appId?: string;
		};

		const appId = "abc.def.ghi";
		const pid = "12345";

		const assertPidTestData = (testData: IiOSSimulatorPidTestData) => {
			const actualResult = helpers.getPidFromiOSSimulatorLogs(testData.appId || appId, testData.input);
			assert.deepEqual(actualResult, testData.expectedResult, `For input ${testData.input}, the expected result is: ${testData.expectedResult}, but actual result is: ${actualResult}.`);
		};

		const getPidFromiOSSimulatorLogsTestData: IiOSSimulatorPidTestData[] = [
			{
				// Real log lines that contain the PID are in this format
				input: `${appId}: ${appId}: ${pid}`,
				expectedResult: pid
			},
			{
				input: `${appId}: ${appId}:          ${pid}`,
				expectedResult: null
			},
			{
				input: `${appId}: ${appId}:${pid}`,
				expectedResult: pid
			},
			{
				input: `${appId}: ${appId}: ${pid} some other data`,
				expectedResult: pid
			},
			{
				input: `${appId}: ${appId}: ${pid} some other data ending with numbers 123`,
				expectedResult: pid
			},
			{
				input: `${appId}: ${pid}`,
				expectedResult: pid
			},
			{
				input: `some not valid app id with: ${pid}`,
				expectedResult: null
			},
			{
				input: null,
				expectedResult: null
			},
			{
				input: undefined,
				expectedResult: null
			},
			{
				input: '',
				expectedResult: null
			},
			{
				input: '        ',
				expectedResult: null
			},
			{
				input: '',
				expectedResult: null
			},
			{
				input: `${appId}: ${appId}\n: ${pid}`,
				expectedResult: null
			},
			{
				input: `org.nativescript.app123456: org.nativescript.app123456: ${pid}`,
				appId: "org.nativescript.app123456",
				expectedResult: pid
			}
		];

		it("returns expected result", () => {
			_.each(getPidFromiOSSimulatorLogsTestData, testData => assertPidTestData(testData));
		});
	});
});
