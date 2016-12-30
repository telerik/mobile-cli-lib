import {AndroidDeviceDiscovery} from "../../../mobile/mobile-core/android-device-discovery";
import {AndroidDebugBridge} from "../../../mobile/android/android-debug-bridge";
import {AndroidDebugBridgeResultHandler} from "../../../mobile/android/android-debug-bridge-result-handler";
import {Yok} from "../../../yok";

import { EventEmitter } from "events";
import { EOL } from "os";
import { assert } from "chai";

class AndroidDeviceMock {
	public deviceInfo: any = {};
	constructor(public identifier: string, public status: string) {
		this.deviceInfo.identifier = identifier;
	}
};

interface IChildProcessMock {
	stdout: MockEventEmitter;
	stderr: MockEventEmitter;
};

class MockEventEmitter extends EventEmitter implements IChildProcessMock {
	public stdout: MockEventEmitter;
	public stderr: MockEventEmitter;
};

let mockStdoutEmitter: MockEventEmitter,
	mockStderrEmitter: MockEventEmitter,
	mockChildProcess: any;

function createTestInjector(): IInjector {
	let injector = new Yok();
	injector.register("injector", injector);
	injector.register("adb", AndroidDebugBridge);
	injector.register("errors", {});
	injector.register("logger", {});
	injector.register("androidDebugBridgeResultHandler", AndroidDebugBridgeResultHandler);
	injector.register("childProcess", {
		spawn: (command: string, args?: string[], options?: any) => {
			mockChildProcess = new MockEventEmitter();
			mockChildProcess.stdout = mockStdoutEmitter;
			mockChildProcess.stderr = mockStderrEmitter;
			return mockChildProcess;
		},
		spawnFromEvent: (command: string, args: string[], event: string, options?: any, spawnFromEventOptions?: any) => {
			return Promise.resolve(args);
		}
	});

	injector.register("staticConfig", {
		getAdbFilePath: () => {
			return Promise.resolve("adbPath");
		}
	});

	injector.register("androidDeviceDiscovery", AndroidDeviceDiscovery);
	let originalResolve = injector.resolve;
	// replace resolve as we do not want to create real AndroidDevice
	let resolve = (param: any, ctorArguments?: IDictionary<any>) => {
		if (ctorArguments && Object.prototype.hasOwnProperty.call(ctorArguments, "status") &&
			Object.prototype.hasOwnProperty.call(ctorArguments, "identifier")) {
			return new AndroidDeviceMock(ctorArguments["identifier"], ctorArguments["status"]);
		} else {
			return originalResolve.apply(injector, [param, ctorArguments]);
		}
	};
	injector.resolve = resolve;

	return injector;
}

describe("androidDeviceDiscovery", () => {
	let androidDeviceDiscovery: Mobile.IAndroidDeviceDiscovery,
		injector: IInjector,
		androidDeviceIdentifier = "androidDevice",
		androidDeviceStatus = "device",
		devicesFound: any[];

	beforeEach(() => {
		mockChildProcess = null;
		injector = createTestInjector();
		mockStdoutEmitter = new MockEventEmitter();
		mockStderrEmitter = new MockEventEmitter();
		androidDeviceDiscovery = injector.resolve("androidDeviceDiscovery");
		devicesFound = [];
	});

	describe("startLookingForDevices", () => {
		it("finds correctly one device", () => {
			androidDeviceDiscovery.on("deviceFound", (device: Mobile.IDevice) => {
				devicesFound.push(device);
			});
			// As startLookingForDevices is blocking, we should emit data on the next tick, so the future will be resolved and we'll receive the data.
			setTimeout(() => {
				let output = `List of devices attached ${EOL}${androidDeviceIdentifier}	${androidDeviceStatus}${EOL}${EOL}`;
				mockStdoutEmitter.emit('data', output);
				mockChildProcess.emit('close', 0);
			}, 1);
			await androidDeviceDiscovery.startLookingForDevices();
			assert.isTrue(devicesFound.length === 1, "We should have found ONE device.");
			assert.deepEqual(devicesFound[0].deviceInfo.identifier, androidDeviceIdentifier);
			assert.deepEqual(devicesFound[0].status, androidDeviceStatus);
		});
	});

	describe("ensureAdbServerStarted", () => {
		it("should spawn adb with start-server parameter", () => {
			let ensureAdbServerStartedOutput = await  androidDeviceDiscovery.ensureAdbServerStarted();
			assert.isTrue(_.includes(ensureAdbServerStartedOutput, "start-server"), "start-server should be passed to adb.");
		});
	});

	describe("checkForDevices", () => {
		it("finds correctly one device", () => {
			let future = new Future<void>();
			androidDeviceDiscovery.on("deviceFound", (device: Mobile.IDevice) => {
				devicesFound.push(device);
				future.return();
			});
			await androidDeviceDiscovery.checkForDevices();
			let output = `List of devices attached ${EOL}${androidDeviceIdentifier}	${androidDeviceStatus}${EOL}${EOL}`;
			mockStdoutEmitter.emit('data', output);
			mockChildProcess.emit('close', 0);
			await future;
			assert.isTrue(devicesFound.length === 1, "We should have found ONE device.");
			assert.deepEqual(devicesFound[0].deviceInfo.identifier, androidDeviceIdentifier);
			assert.deepEqual(devicesFound[0].status, androidDeviceStatus);
		});

		it("finds correctly more than one device", () => {
			let future = new Future<void>();
			androidDeviceDiscovery.on("deviceFound", (device: Mobile.IDevice) => {
				devicesFound.push(device);
				if (devicesFound.length === 2) {
					future.return();
				}
			});
			await androidDeviceDiscovery.checkForDevices();
			let output = `List of devices attached ${EOL}${androidDeviceIdentifier}	${androidDeviceStatus}${EOL}secondDevice	${androidDeviceStatus}${EOL}`;
			mockStdoutEmitter.emit('data', output);
			mockChildProcess.emit('close', 0);
			await future;
			assert.isTrue(devicesFound.length === 2, "We should have found two devices.");
			assert.deepEqual(devicesFound[0].deviceInfo.identifier, androidDeviceIdentifier);
			assert.deepEqual(devicesFound[0].status, androidDeviceStatus);
			assert.deepEqual(devicesFound[1].deviceInfo.identifier, "secondDevice");
			assert.deepEqual(devicesFound[1].status, androidDeviceStatus);
		});

		it("does not find any devices when there are no devices", () => {
			androidDeviceDiscovery.on("deviceFound", (device: Mobile.IDevice) => {
				throw new Error("Devices should not be found.");
			});
			await androidDeviceDiscovery.checkForDevices();
			let output = `List of devices attached${EOL}`;
			mockStdoutEmitter.emit('data', output);
			mockChildProcess.emit('close', 0);
			assert.isTrue(devicesFound.length === 0, "We should have NOT found devices.");
		});

		describe("when device is already found", () => {
			let defaultAdbOutput = `List of devices attached ${EOL}${androidDeviceIdentifier}	${androidDeviceStatus}${EOL}${EOL}`;
			beforeEach(() => {
				let future = new Future<void>();
				let deviceFoundHandler = (device: Mobile.IDevice) => {
					devicesFound.push(device);
					future.return();
				};
				androidDeviceDiscovery.on("deviceFound", deviceFoundHandler);
				await androidDeviceDiscovery.checkForDevices();
				mockStdoutEmitter.emit('data', defaultAdbOutput);
				mockChildProcess.emit('close', 0);
				await future;
				androidDeviceDiscovery.removeListener("deviceFound", deviceFoundHandler);
			});

			it("does not report it as found next time when checkForDevices is called and same device is still connected", () => {
				androidDeviceDiscovery.on("deviceFound", (device: Mobile.IDevice) => {
					throw new Error("Should not report same device as found");
				});
				await androidDeviceDiscovery.checkForDevices();
				mockStdoutEmitter.emit('data', defaultAdbOutput);
				mockChildProcess.emit('close', 0);
				assert.isTrue(devicesFound.length === 1, "We should have found ONE device.");
				assert.deepEqual(devicesFound[0].deviceInfo.identifier, androidDeviceIdentifier);
				assert.deepEqual(devicesFound[0].status, androidDeviceStatus);
			});

			it("reports it as removed next time when called and device is removed", () => {
				let future = new Future<any>();
				androidDeviceDiscovery.on("deviceLost", (device: Mobile.IDevice) => {
					future.return(device);
				});

				await androidDeviceDiscovery.checkForDevices();
				let output = `List of devices attached${EOL}`;
				mockStdoutEmitter.emit('data', output);
				mockChildProcess.emit('close', 0);
				let lostDevice = await  future;
				assert.deepEqual(lostDevice.deviceInfo.identifier, androidDeviceIdentifier);
				assert.deepEqual(lostDevice.status, androidDeviceStatus);
			});

			it("does not report it as removed two times when called and device is removed", () => {
				let future = new Future<any>();
				androidDeviceDiscovery.on("deviceLost", (device: Mobile.IDevice) => {
					future.return(device);
				});

				await androidDeviceDiscovery.checkForDevices();
				let output = `List of devices attached${EOL}`;
				mockStdoutEmitter.emit('data', output);
				mockChildProcess.emit('close', 0);
				let lostDevice = await  future;
				assert.deepEqual(lostDevice.deviceInfo.identifier, androidDeviceIdentifier);
				assert.deepEqual(lostDevice.status, androidDeviceStatus);

				androidDeviceDiscovery.on("deviceLost", (device: Mobile.IDevice) => {
					throw new Error("Should not report device as removed next time after it has been already reported.");
				});
				await androidDeviceDiscovery.checkForDevices();
				mockStdoutEmitter.emit('data', output);
				mockChildProcess.emit('close', 0);
			});

			it("reports it as removed and added after that next time when called and device's status is changed", () => {
				let deviceLostFuture = new Future<any>();
				let deviceFoundFuture = new Future<any>();
				androidDeviceDiscovery.on("deviceLost", (device: Mobile.IDevice) => {
					_.remove(devicesFound, d => d.deviceInfo.identifier === device.deviceInfo.identifier);
					deviceLostFuture.return(device);
				});

				androidDeviceDiscovery.on("deviceFound", (device: Mobile.IDevice) => {
					devicesFound.push(device);
					deviceFoundFuture.return(device);
				});

				await androidDeviceDiscovery.checkForDevices();
				let output = `List of devices attached${EOL}${androidDeviceIdentifier}	unauthorized${EOL}${EOL}`;
				mockStdoutEmitter.emit('data', output);
				mockChildProcess.emit('close', 0);
				let lostDevice = await  deviceLostFuture;
				assert.deepEqual(lostDevice.deviceInfo.identifier, androidDeviceIdentifier);
				assert.deepEqual(lostDevice.status, androidDeviceStatus);

				await deviceFoundFuture;
				assert.isTrue(devicesFound.length === 1, "We should have found ONE device.");
				assert.deepEqual(devicesFound[0].deviceInfo.identifier, androidDeviceIdentifier);
				assert.deepEqual(devicesFound[0].status, "unauthorized");

				// Verify the device will not be reported as found next time when adb returns the same output:
				// In case it is reported, an error will be raised - Future resolved more than once for deviceFoundFuture
				await androidDeviceDiscovery.checkForDevices();
				mockStdoutEmitter.emit('data', output);
				mockChildProcess.emit('close', 0);
				assert.isTrue(devicesFound.length === 1, "We should have found ONE device.");
			});
		});

		it("throws error when adb writes on stderr", () => {
			androidDeviceDiscovery.on("deviceFound", (device: Mobile.IDevice) => {
				throw new Error("Devices should not be found.");
			});
			let error = new Error("ADB Error");
			try {
				await androidDeviceDiscovery.checkForDevices();
				mockStderrEmitter.emit('data', error);
			} catch (err) {
				assert.deepEqual(err, error);
			}
		});

		it("throws error when adb's child process throws error", () => {
			androidDeviceDiscovery.on("deviceFound", (device: Mobile.IDevice) => {
				throw new Error("Devices should not be found.");
			});
			let error = new Error("ADB Error");
			try {
				await androidDeviceDiscovery.checkForDevices();
				mockChildProcess.emit('error', error);
			} catch (err) {
				assert.deepEqual(err, error);
			}
		});
	});
});
