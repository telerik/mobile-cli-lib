import * as helpers from "../../helpers";
import { assert } from "chai";
import { EOL } from "os";

interface ITestData {
	input: any;
	expectedResult: any;
	expectedError?: any;
}

describe("helpers", () => {

	let assertTestData = (testData: ITestData, method: Function) => {
		let actualResult = method(testData.input);
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
				input: [Promise.resolve(1), Promise.reject(2)],
				expectedResult: null,
				expectedError: getErrorMessage([2])
			},
			{
				input: [Promise.reject(1), Promise.resolve(2)],
				expectedResult: null,
				expectedError: getErrorMessage([1])
			},
			{
				input: [Promise.resolve(1), Promise.reject(2), Promise.resolve(3), Promise.reject(new Error("4"))],
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
				input: [Promise.reject(1), Promise.resolve(2).then(() => isPromiseSettled = true)],
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
});
