import { Yok } from "../../yok";
import { Logger } from "../../logger";
import * as assert from "assert";

const passwordReplacement = "*******";
const debugTrace = ["debug", "trace"];
const passwordPair = ["password", "Password"];

function createTestInjector(logLevel?: string): IInjector {
	let testInjector = new Yok();
	testInjector.register("injector", testInjector);
	testInjector.register("config", {});
	testInjector.register("options", {
		log: logLevel
	});
	testInjector.register("logger", Logger);

	return testInjector;
}

describe("logger", () => {
	let testInjector: IInjector,
		logger: any,
		outputs: any;

	beforeEach(() => {
		testInjector = createTestInjector();
		logger = testInjector.resolve("logger");
		outputs = {
			debug: "",
			trace: ""
		};

		const log4jsLogger = {
			debug: (...args: string[]) => {
				outputs.debug += args.join("");
			},
			trace: (...args: string[]) => {
				outputs.trace += args.join("");
			}
		};

		logger.log4jsLogger = log4jsLogger;
	});

	describe(debugTrace.join("+"), () => {
		_.each(debugTrace, methodName => {
			_.each(passwordPair, passwordString => {
				it(`${methodName} should obfuscate properties ending in '${passwordString}' with values surrounded by single quotes`, () => {
					const logArgument = `{ certificate${passwordString}: 'pass', otherProperty: 'pass' }`;

					logger[methodName].call(logger, logArgument);

					assert.deepStrictEqual(outputs[methodName], `{ certificate${passwordString}: '${passwordReplacement}', otherProperty: 'pass' }`, `logger.${methodName} should obfuscate ${passwordString} properties`);
				});

				it(`${methodName} should obfuscate properties ending in '${passwordString}' with values surrounded by single quotes when it is the last property`, () => {
					const logArgument = `{ certificate${passwordString}: 'pass' }`;

					logger[methodName].call(logger, logArgument);

					assert.deepStrictEqual(outputs[methodName], `{ certificate${passwordString}: '${passwordReplacement}' }`, `logger.${methodName} should obfuscate ${passwordString} properties`);
				});

				it(`${methodName} should obfuscate properties ending in '${passwordString}' with values surrounded by double quotes`, () => {
					const logArgument = `{ certificate${passwordString}: "pass", otherProperty: "pass" }`;

					logger[methodName].call(logger, logArgument);

					assert.deepStrictEqual(outputs[methodName], `{ certificate${passwordString}: "${passwordReplacement}", otherProperty: "pass" }`, `logger.${methodName} should obfuscate ${passwordString} properties`);
				});

				it(`${methodName} should obfuscate properties ending in '${passwordString}' with values surrounded by double quotes when it is the last property`, () => {
					const logArgument = `{ certificate${passwordString}: "pass" }`;

					logger[methodName].call(logger, logArgument);

					assert.deepStrictEqual(outputs[methodName], `{ certificate${passwordString}: "${passwordReplacement}" }`, `logger.${methodName} should obfuscate ${passwordString} properties`);
				});

				it(`${methodName} should obfuscate '${passwordString}' query parameter when it is the last query parameter`, () => {
					const logArgument = `{ proto: 'https', host: 'platform.telerik.com', path: '/appbuilder/api/itmstransporter/applications?username=dragon.telerikov%40yahoo.com&${passwordString}=somePassword', method: 'POST' }`;

					logger[methodName].call(logger, logArgument);

					assert.deepStrictEqual(outputs[methodName], `{ proto: 'https', host: 'platform.telerik.com', path: '/appbuilder/api/itmstransporter/applications?username=dragon.telerikov%40yahoo.com&${passwordString}=${passwordReplacement}', method: 'POST' }`, `logger.${methodName} should obfuscate ${passwordString} when in query parameter`);
				});

				it(`${methodName} should obfuscate '${passwordString}' query parameter when it is not the last query parameter`, () => {
					const logArgument = `{ proto: 'https', host: 'platform.telerik.com', path: '/appbuilder/api/itmstransporter/applications?username=dragon.telerikov%40yahoo.com&${passwordString}=somePassword&data=someOtherData', method: 'POST' }`;

					logger[methodName].call(logger, logArgument);

					assert.deepStrictEqual(outputs[methodName], `{ proto: 'https', host: 'platform.telerik.com', path: '/appbuilder/api/itmstransporter/applications?username=dragon.telerikov%40yahoo.com&${passwordString}=${passwordReplacement}&data=someOtherData', method: 'POST' }`, `logger.${methodName} should obfuscate ${passwordString} when in query parameter`);
				});
			});
		});
	});

	describe("trace", () => {
		it("should obfuscate body of request to /api/itmstransporter", () => {
			const request = "{ proto: 'https', host: 'platform.telerik.com', path: '/appbuilder/api/itmstransporter/applications?username=dragon.telerikov%40yahoo.com', method: 'POST' }";
			const requestBody = '"password"';

			logger.trace(request, requestBody);

			assert.deepEqual(outputs.trace, `${request}"${passwordReplacement}"`, "logger.trace should obfuscate body of api/itmstransporter requests");
		});

		it("should not obfuscate body of other requests", () => {
			const request = "{ proto: 'https', host: 'platform.telerik.com', path: '/appbuilder/api/endpoint/applications?data=somedata, method: 'POST' }";
			const requestBody = '"password"';

			logger.trace(request, requestBody);

			assert.deepEqual(outputs.trace, `${request}${requestBody}`, "logger.trace should not obfuscate body of request unless it is towards api/itmstransporter");
		});
	});
});
