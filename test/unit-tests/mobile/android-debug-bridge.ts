import { AndroidDebugBridge } from "../../../mobile/android/android-debug-bridge";
import { assert } from "chai";
import { Yok } from "../../../yok";
import { CommonLoggerStub, ErrorsStub } from "../stubs";
import { AndroidDebugBridgeResultHandler } from "../../../mobile/android/android-debug-bridge-result-handler";
const adbPath = "testAdb";
const adbError = "No space left on device.";
const adbResponse = "My Cool Response";

describe('androidDebugBridge', () => {
	let logger: CommonLoggerStub;
	let adb: any;

	let isAdbSpawnedFromChildProcess = false;
	let isAdbSpawnedFromEvent = false;
	let spawnedEvent = "";
	let spawnedEventOptions = "";
	let spawnedArgs: string[] = [];
	let allSpawnedEventsArgs: string[][] = [];

	function setup(options?: {
		returnError?: boolean
	}): void {
		options = options || {};
		isAdbSpawnedFromEvent = false;
		isAdbSpawnedFromChildProcess = false;
		spawnedEvent = "";
		spawnedEventOptions = "";
		spawnedArgs = [];
		allSpawnedEventsArgs = [];
		createTestInjector(options);
	}

	function createTestInjector(options?: {
		returnError?: boolean
	}): void {
		options = options || {};
		const injector = new Yok();
		injector.register("logger", CommonLoggerStub);
		injector.register("errors", ErrorsStub);
		injector.register("config", {});
		injector.register("options", {});
		injector.register("staticConfig", {
			getAdbFilePath: async () => { return adbPath; }
		});
		injector.register("androidDebugBridgeResultHandler", AndroidDebugBridgeResultHandler);
		injector.register("childProcess", {
			spawnFromEvent: async (command: string, args: string[],
				event: string, opts?: any): Promise<ISpawnResult> => {
				isAdbSpawnedFromEvent = command.indexOf(adbPath) !== -1;
				spawnedArgs = args;
				allSpawnedEventsArgs.push(args);
				spawnedEvent = event;
				spawnedEventOptions = opts;

				return {
					stderr: options.returnError ? adbError : "",
					stdout: options.returnError ? "" : adbResponse,
					exitCode: options.returnError ? 1 : 0
				};
			},
			spawn: async (command: string, args?: string[], opts?: any): Promise<any> => {
				isAdbSpawnedFromChildProcess = command.indexOf(adbPath) !== -1;
				spawnedArgs = args;

				return {
					stderr: options.returnError ? adbError : "",
					stdout: options.returnError ? "" : adbResponse,
				};
			}
		});
		adb = injector.resolve(AndroidDebugBridge);
		logger = injector.resolve("logger");
	}

	_.each(['executeCommand', 'executeShellCommand'], methodName => {
		describe(methodName, () => {

			it('should spawn from event by default', async () => {
				const expectedArgs = getArgs();
				setup();

				const actualResponse = await adb[methodName](expectedArgs);

				assert.isTrue(isAdbSpawnedFromEvent);
				assert.deepEqual(spawnedArgs, expectedArgs);
				assert.equal(actualResponse, adbResponse);
			});

			it('should spawn a child process when specified', async () => {
				const expectedArgs = getArgs();
				setup();

				await adb[methodName](expectedArgs, { returnChildProcess: true });

				assert.isTrue(isAdbSpawnedFromChildProcess);
				assert.deepEqual(spawnedArgs, expectedArgs);
			});

			it('should spawn with event when specified', async () => {
				const expectedArgs = getArgs();
				const expectedEvent = "MyCoolEvent";
				setup();

				const actualResponse = await adb[methodName](expectedArgs, { fromEvent: expectedEvent });

				assert.isTrue(isAdbSpawnedFromEvent);
				assert.equal(spawnedEvent, expectedEvent);
				assert.deepEqual(spawnedArgs, expectedArgs);
				assert.equal(actualResponse, adbResponse);
			});

			it('should spawn with event options when childProcessOptions specified', async () => {
				const expectedArgs = getArgs();
				const expectedEventOptions = "MyCoolEventOptions";
				setup();

				const actualResponse = await adb[methodName](expectedArgs, { childProcessOptions: expectedEventOptions });

				assert.isTrue(isAdbSpawnedFromEvent);
				assert.equal(spawnedEventOptions, expectedEventOptions);
				assert.deepEqual(spawnedArgs, expectedArgs);
				assert.equal(actualResponse, adbResponse);
			});

			it('should fail when adb returns a known error', async () => {
				setup({
					returnError: true
				});

				let actualError = "";
				try {
					await adb[methodName]([]);
				} catch (error) {
					actualError = error.message;
				}

				assert.equal(actualError, adbError);
				assert.isTrue(logger.output.indexOf(adbError) === -1);
			});

			it('should log a warning when adb returns a known error and treatErrorsAsWarnings is set to true', async () => {
				setup({
					returnError: true
				});

				const actualResponse = await adb[methodName]([], { treatErrorsAsWarnings: true });

				assert.isTrue(isAdbSpawnedFromEvent);
				assert.isTrue(logger.output.indexOf(adbError) !== -1);
				assert.equal(actualResponse, "");
			});
		});

		function getArgs(): string[] {
			const expectedArgs = [ 'MyCoolArg' ];
			if (methodName === 'executeShellCommand') {
				expectedArgs.unshift('shell');
			}

			return expectedArgs;
		}
	});

	describe('pushFile', () => {
		it('should ensure its folder, push and set permissions', async () => {
			const sampleLocalFilePath = "MyCoolLocalFolder/MyCoolLocalFile";
			const sampleDeviceFolder = "MyCoolDeviceFolder";
			const deviceFilePath =  `${sampleDeviceFolder}/myDevicePath`;
			setup();

			await adb.pushFile(sampleLocalFilePath, deviceFilePath);

			assert.isTrue(isAdbSpawnedFromEvent);
			assert.equal(allSpawnedEventsArgs.length, 3);
			assert.deepEqual(allSpawnedEventsArgs[0], [ 'shell', 'mkdir', '-p', sampleDeviceFolder ]);
			assert.deepEqual(allSpawnedEventsArgs[1], [ 'push', sampleLocalFilePath, deviceFilePath ]);
			assert.deepEqual(allSpawnedEventsArgs[2], [ 'shell', 'chmod', '0777', sampleDeviceFolder ]);
		});
	});

	describe("pushDir", () => {
		it("should ensure directory is pushed with correct permissions", async () => {
			const localDirPath = "myLocalDirRoot/dirName";
			const deviceDirPath = "myDeviceDirRoot";
			setup();

			await adb.pushDir(localDirPath, deviceDirPath);

			assert.isTrue(isAdbSpawnedFromEvent);
			assert.equal(allSpawnedEventsArgs.length, 2);
			assert.deepEqual(allSpawnedEventsArgs[0], ["push", localDirPath, deviceDirPath]);
			assert.deepEqual(allSpawnedEventsArgs[1], ["shell", "chmod", "0777", deviceDirPath]);
		});
	});

	describe("removeFile", () => {
		it("should remove file from device", async () => {
			const deviceFilePath = "myDeviceDirRoot/myFile.js";
			setup();

			await adb.removeFile(deviceFilePath);

			assert.isTrue(isAdbSpawnedFromEvent);
			assert.equal(allSpawnedEventsArgs.length, 1);
			assert.deepEqual(allSpawnedEventsArgs[0], ["shell", "rm", "-rf", deviceFilePath]);
		});
	});
});
