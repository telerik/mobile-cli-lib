///<reference path="../../.d.ts"/>
"use strict";
import {DevicesService} from "../../../mobile/mobile-core/devices-service";
import {Yok} from "../../../yok";
import Future = require("fibers/future");
import { EventEmitter } from "events";
import { assert } from "chai";
import { CommonLoggerStub, ErrorsStub } from "../stubs";
import { Messages } from "../../../messages/messages";
import * as constants from "../../../mobile/constants";
import { DevicePlatformsConstants } from "../../../mobile/device-platforms-constants";

class IOSDeviceDiscoveryStub extends EventEmitter {
	public startLookingForDevices(): IFuture<void> {
		return Future.fromResult();
	}

	public checkForDevices(): IFuture<void> {
		return Future.fromResult();
	}
}

class AndroidDeviceDiscoveryStub extends EventEmitter {
	public startLookingForDevices(): IFuture<void> {
		return Future.fromResult();
	}

	public checkForDevices(): IFuture<void> {
		return Future.fromResult();
	}
}

class IOSSimulatorDiscoveryStub extends EventEmitter {
	public startLookingForDevices(): IFuture<void> {
		return Future.fromResult();
	}

	public checkForDevices(): IFuture<void> {
		return Future.fromResult();
	}
}

let androidDeviceDiscovery: EventEmitter,
	iOSDeviceDiscovery: EventEmitter,
	iOSSimulatorDiscovery: EventEmitter,
	androidEmulatorDevice: any = { deviceInfo: { identifier: "androidEmulatorDevice", platform: "android" }, isEmulator: true },
	iOSSimulator = {
		deviceInfo: {
			identifier: "ios-simulator-device",
			platform: "ios"
		},
		applicationManager: {
			getInstalledApplications: () => Future.fromResult(["com.telerik.unitTest1", "com.telerik.unitTest2"]),
			canStartApplication: () => true,
			startApplication: (packageName: string, framework: string) => Future.fromResult(),
			tryStartApplication: (packageName: string, framework: string) => Future.fromResult(),
			reinstallApplication: (packageName: string, packageFile: string) => Future.fromResult(),
			isApplicationInstalled: (packageName: string) => Future.fromResult(_.contains(["com.telerik.unitTest1", "com.telerik.unitTest2"], packageName)),
			isLiveSyncSupported: (appIdentifier: string) => Future.fromResult(_.contains(["com.telerik.unitTest1", "com.telerik.unitTest2"], appIdentifier))
		},
		deploy: (packageFile: string, packageName: string) => Future.fromResult(),
		isEmulator: true
	};

class AndroidEmulatorServices {
	public isStartEmulatorCalled = false;
	public startEmulator(): IFuture<void> {
		this.isStartEmulatorCalled = true;
		androidDeviceDiscovery.emit("deviceFound", androidEmulatorDevice);
		return Future.fromResult();
	}
}

class IOSEmulatorServices {
	public isStartEmulatorCalled = false;
	public startEmulator(): IFuture<void> {
		if (!this.isStartEmulatorCalled) {
			this.isStartEmulatorCalled = true;
			iOSSimulatorDiscovery.emit("deviceFound", iOSSimulator);
		}
		return Future.fromResult();
	}
}

function createTestInjector(): IInjector {
	let testInjector = new Yok();
	testInjector.register("logger", CommonLoggerStub);
	testInjector.register("errors", ErrorsStub);
	testInjector.register("iOSDeviceDiscovery", IOSDeviceDiscoveryStub);
	testInjector.register("iOSSimulatorDiscovery", IOSSimulatorDiscoveryStub);
	testInjector.register("androidDeviceDiscovery", AndroidDeviceDiscoveryStub);
	testInjector.register("staticConfig", { CLIENT_NAME: "unit-tests" });
	testInjector.register("devicePlatformsConstants", DevicePlatformsConstants);
	testInjector.register("androidEmulatorServices", AndroidEmulatorServices);
	testInjector.register("iOSEmulatorServices", IOSEmulatorServices);
	testInjector.register("messages", Messages);
	testInjector.register("mobileHelper", {
		platformNames: ["ios", "android"],
		validatePlatformName: (platform: string) => platform.toLowerCase(),
		getPlatformCapabilities: (platform: string) => { return { cableDeploy: true }; },
		isiOSPlatform: (platform: string) => !!(platform && platform.toLowerCase() === "ios"),
		isAndroidPlatform: (platform: string) => !!(platform && platform.toLowerCase() === "android")
	});
	testInjector.register("deviceLogProvider", {
		setLogLevel: (logLevel: string, deviceIdentifier: string) => { /* no implementation required */ }
	});

	testInjector.register("devicesService", DevicesService);
	testInjector.register("hostInfo", {
		isDarwin: false
	});
	testInjector.register("options", {
		emulator: false
	});
	testInjector.register("androidProcessService", { /* no implementation required */ });
	return testInjector;
}

describe("devicesService", () => {
	let counter = 0,
		iOSDevice = {
			deviceInfo: {
				identifier: "ios-device",
				platform: "ios"
			},
			applicationManager: {
				getInstalledApplications: () => Future.fromResult(["com.telerik.unitTest1", "com.telerik.unitTest2"]),
				canStartApplication: () => true,
				startApplication: (packageName: string, framework: string) => Future.fromResult(),
				tryStartApplication: (packageName: string, framework: string) => Future.fromResult(),
				reinstallApplication: (packageName: string, packageFile: string) => Future.fromResult(),
				isApplicationInstalled: (packageName: string) => Future.fromResult(_.contains(["com.telerik.unitTest1", "com.telerik.unitTest2"], packageName)),
				isLiveSyncSupported: (appIdentifier: string) => Future.fromResult(_.contains(["com.telerik.unitTest1", "com.telerik.unitTest2"], appIdentifier))
			},
			deploy: (packageFile: string, packageName: string) => Future.fromResult()
		},
		androidDevice = {
			deviceInfo: {
				identifier: "android-device",
				platform: "android"
			},
			applicationManager: {
				getInstalledApplications: () => Future.fromResult(["com.telerik.unitTest1", "com.telerik.unitTest2", "com.telerik.unitTest3"]),
				canStartApplication: () => true,
				startApplication: (packageName: string, framework: string) => Future.fromResult(),
				tryStartApplication: (packageName: string, framework: string) => Future.fromResult(),
				reinstallApplication: (packageName: string, packageFile: string) => Future.fromResult(),
				isApplicationInstalled: (packageName: string) => Future.fromResult(_.contains(["com.telerik.unitTest1", "com.telerik.unitTest2", "com.telerik.unitTest3"], packageName)),
				isLiveSyncSupported: (appIdentifier: string) => Future.fromResult(_.contains(["com.telerik.unitTest1", "com.telerik.unitTest2", "com.telerik.unitTest3"], appIdentifier))
			},
			deploy: (packageFile: string, packageName: string) => Future.fromResult()
		},
		testInjector: IInjector,
		devicesService: Mobile.IDevicesService,
		androidEmulatorServices: any,
		logger: CommonLoggerStub,
		assertAndroidEmulatorIsStarted = () => {
			assert.isFalse(androidEmulatorServices.isStartEmulatorCalled);
			devicesService.execute(() => { counter++; return Future.fromResult(); }, () => true).wait();
			assert.deepEqual(counter, 1, "The action must be executed on only one device.");
			assert.isTrue(androidEmulatorServices.isStartEmulatorCalled);
			androidDeviceDiscovery.emit("deviceLost", androidEmulatorDevice);
			androidEmulatorServices.isStartEmulatorCalled = false;
		};

	beforeEach(() => {
		testInjector = createTestInjector();
		devicesService = testInjector.resolve("devicesService");
		iOSDeviceDiscovery = testInjector.resolve("iOSDeviceDiscovery");
		iOSSimulatorDiscovery = testInjector.resolve("iOSSimulatorDiscovery");
		androidDeviceDiscovery = testInjector.resolve("androidDeviceDiscovery");
		androidEmulatorServices = testInjector.resolve("androidEmulatorServices");
		logger = testInjector.resolve("logger");
		counter = 0;
	});

	it("attaches to events when a new DevicesService is instantiated", () => {
		iOSDeviceDiscovery.emit("deviceFound", iOSDevice);
		androidDeviceDiscovery.emit("deviceFound", androidDevice);
		let devices = devicesService.getDeviceInstances();
		assert.isTrue(devicesService.hasDevices, "After emitting two devices, hasDevices must be true");
		assert.deepEqual(devices[0], iOSDevice);
		assert.deepEqual(devices[1], androidDevice);
	});

	describe("hasDevices", () => {
		it("is true when device is found", () => {
			assert.isFalse(devicesService.hasDevices, "Initially devicesService hasDevices must be false.");
			androidDeviceDiscovery.emit("deviceFound", androidDevice);
			assert.isTrue(devicesService.hasDevices, "After emitting, hasDevices must be true");
		});

		it("is false when device is found and lost after that", () => {
			assert.isFalse(devicesService.hasDevices, "Initially devicesService hasDevices must be false.");
			androidDeviceDiscovery.emit("deviceFound", androidDevice);
			androidDeviceDiscovery.emit("deviceLost", androidDevice);
			assert.isFalse(devicesService.hasDevices, "After losing all devices, hasDevices must be false.");
		});

		it("is true when two devices are found and one of them is lost after that", () => {
			assert.isFalse(devicesService.hasDevices, "Initially devicesService hasDevices must be false.");
			androidDeviceDiscovery.emit("deviceFound", androidDevice);
			iOSDeviceDiscovery.emit("deviceFound", iOSDevice);
			androidDeviceDiscovery.emit("deviceLost", androidDevice);
			assert.isTrue(devicesService.hasDevices, "After losing only one of two devices, hasDevices must be true.");
		});
	});

	describe("getDeviceInstances and getDevices", () => {
		it("returns one android device, when only one device is attached", () => {
			assert.deepEqual(devicesService.getDeviceInstances(), [], "Initially getDevicesInstances must return empty array.");
			assert.deepEqual(devicesService.getDevices(), [], "Initially getDevices must return empty array.");

			androidDeviceDiscovery.emit("deviceFound", androidDevice);
			assert.deepEqual(devicesService.getDeviceInstances(), [androidDevice]);
			assert.deepEqual(devicesService.getDevices(), [androidDevice.deviceInfo]);
		});

		it("does not return any devices, when only one device is attached and it is removed after that", () => {
			assert.deepEqual(devicesService.getDeviceInstances(), [], "Initially getDevicesInstances must return empty array.");
			assert.deepEqual(devicesService.getDevices(), [], "Initially getDevices must return empty array.");

			androidDeviceDiscovery.emit("deviceFound", androidDevice);
			assert.deepEqual(devicesService.getDeviceInstances(), [androidDevice]);
			assert.deepEqual(devicesService.getDevices(), [androidDevice.deviceInfo]);

			androidDeviceDiscovery.emit("deviceLost", androidDevice);
			assert.deepEqual(devicesService.getDeviceInstances(), [], "When all devices are lost, getDevicesInstances must return empty array.");
			assert.deepEqual(devicesService.getDevices(), [], "When all devices are lost, getDevices must return empty array.");
		});

		it("returns one android device, when two devices are attached and one of them is removed", () => {
			assert.deepEqual(devicesService.getDeviceInstances(), [], "Initially getDevicesInstances must return empty array.");
			assert.deepEqual(devicesService.getDevices(), [], "Initially getDevices must return empty array.");

			let tempDevice = { deviceInfo: { identifier: "temp-device" } };
			androidDeviceDiscovery.emit("deviceFound", androidDevice);
			androidDeviceDiscovery.emit("deviceFound", tempDevice);
			assert.deepEqual(devicesService.getDeviceInstances(), [androidDevice, tempDevice]);
			assert.deepEqual(devicesService.getDevices(), [androidDevice.deviceInfo, tempDevice.deviceInfo]);

			androidDeviceDiscovery.emit("deviceLost", tempDevice);
			assert.deepEqual(devicesService.getDeviceInstances(), [androidDevice]);
			assert.deepEqual(devicesService.getDevices(), [androidDevice.deviceInfo]);
		});
	});

	describe("isAppInstalledOnDevices", () => {
		beforeEach(() => {
			androidDeviceDiscovery.emit("deviceFound", androidDevice);
			iOSDeviceDiscovery.emit("deviceFound", iOSDevice);
		});

		it("returns true for each device on which the app is installed", () => {
			let deviceIdentifiers = [androidDevice.deviceInfo.identifier, iOSDevice.deviceInfo.identifier],
				appId = "com.telerik.unitTest1";
			let results = devicesService.isAppInstalledOnDevices(deviceIdentifiers, appId, "cordova");
			assert.isTrue(results.length > 0);
			_.each(results, (futurizedResult: IFuture<IAppInstalledInfo>, index: number) => {
				let realResult = futurizedResult.wait();
				assert.isTrue(realResult.isInstalled);
				assert.deepEqual(realResult.appIdentifier, appId);
				assert.deepEqual(realResult.deviceIdentifier, deviceIdentifiers[index]);
				assert.deepEqual(realResult.isLiveSyncSupported, true);
			});
		});

		it("returns false for each device on which the app is not installed", () => {
			let results = devicesService.isAppInstalledOnDevices([androidDevice.deviceInfo.identifier, iOSDevice.deviceInfo.identifier], "com.telerik.unitTest3", "cordova");
			assert.isTrue(results.length > 0);
			Future.wait(results);
			assert.deepEqual(results.map(r => r.get().isInstalled), [true, false]);
		});

		it("throws error when invalid identifier is passed", () => {
			let results = devicesService.isAppInstalledOnDevices(["invalidDeviceId", iOSDevice.deviceInfo.identifier], "com.telerik.unitTest1", "cordova");
			assert.throws(() => Future.wait(results));
			_.each(results, futurizedResult => {
				let error = futurizedResult.error;
				if (error) {
					assert.isTrue(error.message.indexOf("invalidDeviceId") !== -1, "The message must contain the id of the invalid device.");
				} else {
					assert.isTrue(futurizedResult.get().isInstalled, "The app is installed on iOS Device, so we must return true.");
				}
			});
		});
	});

	describe("initialize and other methods behavior after initialze work correctly", () => {
		let tempDevice = {
			deviceInfo: {
				identifier: "temp-device",
				platform: "android"
			},
			applicationManager: {
				getInstalledApplications: () => Future.fromResult(["com.telerik.unitTest1", "com.telerik.unitTest2", "com.telerik.unitTest3"]),
				isApplicationInstalled: (packageName: string) => Future.fromResult(_.contains(["com.telerik.unitTest1", "com.telerik.unitTest2", "com.telerik.unitTest3"], packageName)),
				isLiveSyncSupported: (appIdentifier: string) => Future.fromResult(_.contains(["com.telerik.unitTest1", "com.telerik.unitTest2", "com.telerik.unitTest3"], appIdentifier))
			}
		};

		describe("when initialize is called with platform and deviceId and device's platform is the same as passed one", () => {

			let assertAllMethodsResults = (deviceId: string) => {
				assert.isFalse(devicesService.hasDevices, "Initially devicesService hasDevices must be false.");
				androidDeviceDiscovery.emit("deviceFound", androidDevice);
				devicesService.initialize({ platform: "android", deviceId: deviceId }).wait();
				assert.deepEqual(devicesService.platform, "android");
				assert.deepEqual(devicesService.deviceCount, 1);
				androidDeviceDiscovery.emit("deviceFound", tempDevice);
				assert.isTrue(devicesService.hasDevices, "After emitting and initializing, hasDevices must be true");
				assert.deepEqual(devicesService.getDeviceInstances(), [androidDevice, tempDevice]);
				assert.deepEqual(devicesService.getDevices(), [androidDevice.deviceInfo, tempDevice.deviceInfo]);
				assert.deepEqual(devicesService.deviceCount, 1);
				devicesService.execute(() => { counter++; return Future.fromResult(); }).wait();
				assert.deepEqual(counter, 1, "The action must be executed on only one device.");
				counter = 0;
				devicesService.execute(() => { counter++; return Future.fromResult(); }, () => false).wait();
				assert.deepEqual(counter, 0, "The action must not be executed when canExecute returns false.");
				counter = 0;
				devicesService.execute(() => { counter++; return Future.fromResult(); }, () => true).wait();
				assert.deepEqual(counter, 1, "The action must be executed on only one device.");
				androidDeviceDiscovery.emit("deviceLost", androidDevice);
				androidDeviceDiscovery.emit("deviceLost", tempDevice);
				counter = 0;
				assertAndroidEmulatorIsStarted();
				counter = 0;
				devicesService.execute(() => { counter++; return Future.fromResult(); }, () => true, { allowNoDevices: true }).wait();
				assert.deepEqual(counter, 0, "The action must not be executed when there are no devices.");
				assert.isTrue(logger.output.indexOf(constants.ERROR_NO_DEVICES) !== -1);
			};

			it("when deviceId is deviceIdentifier", () => {
				assertAllMethodsResults(androidDevice.deviceInfo.identifier);
			});

			it("when deviceId is index", () => {
				assertAllMethodsResults("1");
			});

			it("fails when deviceId is invalid index (less than 0)", () => {
				assert.throws(() => devicesService.initialize({ platform: "android", deviceId: "-1" }).wait());
			});

			it("fails when deviceId is invalid index (more than currently connected devices)", () => {
				assert.throws(() => devicesService.initialize({ platform: "android", deviceId: "100" }).wait());
			});

			it("does not fail when iOSDeviceDiscovery startLookingForDevices fails", () => {
				(<any>iOSDeviceDiscovery).startLookingForDevices = (): IFuture<void> => { throw new Error("my error"); };
				assertAllMethodsResults("1");
				assert.isTrue(logger.traceOutput.indexOf("my error") !== -1);
			});

			it("does not fail when androidDeviceDiscovery startLookingForDevices fails", () => {
				(<any>androidDeviceDiscovery).startLookingForDevices = (): IFuture<void> => { throw new Error("my error"); };
				iOSDeviceDiscovery.emit("deviceFound", iOSDevice);
				devicesService.initialize({ platform: "ios", deviceId: iOSDevice.deviceInfo.identifier }).wait();
				assert.isTrue(logger.traceOutput.indexOf("my error") !== -1);
			});

			it("does not fail when iosSimulatorDiscovery startLookingForDevices fails", () => {
				let hostInfo = testInjector.resolve("hostInfo");
				hostInfo.isDarwin = true;
				(<any>iOSSimulatorDiscovery).startLookingForDevices = (): IFuture<void> => { throw new Error("my error"); };
				iOSDeviceDiscovery.emit("deviceFound", iOSDevice);
				devicesService.initialize({ platform: "ios", deviceId: iOSDevice.deviceInfo.identifier }).wait();
				assert.isTrue(logger.traceOutput.indexOf("my error") !== -1);
			});
		});

		it("when initialize is called with platform and deviceId and such device cannot be found", () => {
			assert.isFalse(devicesService.hasDevices, "Initially devicesService hasDevices must be false.");
			assert.throws(() => devicesService.initialize({ platform: "android", deviceId: androidDevice.deviceInfo.identifier }).wait());
		});

		it("when initialize is called with deviceId and invalid platform", () => {
			assert.isFalse(devicesService.hasDevices, "Initially devicesService hasDevices must be false.");
			iOSDeviceDiscovery.emit("deviceFound", iOSDevice);
			androidDeviceDiscovery.emit("deviceFound", androidDevice);
			assert.throws(() => devicesService.initialize({ platform: "invalidPlatform", deviceId: androidDevice.deviceInfo.identifier }).wait());
		});

		it("when initialize is called with platform and deviceId and device's platform is different", () => {
			assert.isFalse(devicesService.hasDevices, "Initially devicesService hasDevices must be false.");
			iOSDeviceDiscovery.emit("deviceFound", iOSDevice);
			androidDeviceDiscovery.emit("deviceFound", androidDevice);
			assert.throws(() => devicesService.initialize({ platform: "ios", deviceId: androidDevice.deviceInfo.identifier }).wait());
		});

		describe("when only deviceIdentifier is passed", () => {

			let assertAllMethodsResults = (deviceId: string) => {
				assert.isFalse(devicesService.hasDevices, "Initially devicesService hasDevices must be false.");
				androidDeviceDiscovery.emit("deviceFound", androidDevice);
				devicesService.initialize({ deviceId: deviceId }).wait();
				assert.deepEqual(devicesService.platform, "android");
				assert.deepEqual(devicesService.deviceCount, 1);
				androidDeviceDiscovery.emit("deviceFound", tempDevice);
				iOSDeviceDiscovery.emit("deviceFound", iOSDevice);
				assert.isTrue(devicesService.hasDevices, "After emitting and initializing, hasDevices must be true");
				assert.deepEqual(devicesService.getDeviceInstances(), [androidDevice, tempDevice, iOSDevice]);
				assert.deepEqual(devicesService.getDevices(), [androidDevice.deviceInfo, tempDevice.deviceInfo, iOSDevice.deviceInfo]);
				assert.deepEqual(devicesService.deviceCount, 1);
				counter = 0;
				devicesService.execute(() => { counter++; return Future.fromResult(); }).wait();
				assert.deepEqual(counter, 1, "The action must be executed on only one device.");
				counter = 0;
				devicesService.execute(() => { counter++; return Future.fromResult(); }, () => false).wait();
				assert.deepEqual(counter, 0, "The action must not be executed when canExecute returns false.");
				counter = 0;
				devicesService.execute(() => { counter++; return Future.fromResult(); }, () => true).wait();
				assert.deepEqual(counter, 1, "The action must be executed on only one device.");
				androidDeviceDiscovery.emit("deviceLost", androidDevice);
				androidDeviceDiscovery.emit("deviceLost", tempDevice);
				iOSDeviceDiscovery.emit("deviceLost", iOSDevice);
				counter = 0;
				assertAndroidEmulatorIsStarted();
				counter = 0;
				devicesService.execute(() => { counter++; return Future.fromResult(); }, () => true, { allowNoDevices: true }).wait();
				assert.deepEqual(counter, 0, "The action must not be executed when there are no devices.");
				assert.isTrue(logger.output.indexOf(constants.ERROR_NO_DEVICES) !== -1);
			};

			it("when deviceId is deviceIdentifier", () => {
				assertAllMethodsResults(androidDevice.deviceInfo.identifier);
			});

			it("when deviceId is index", () => {
				assertAllMethodsResults("1");
			});

			it("fails when deviceId is invalid index (less than 0)", () => {
				assert.throws(() => devicesService.initialize({ deviceId: "-1" }).wait());
			});

			it("fails when deviceId is invalid index (more than currently connected devices)", () => {
				assert.throws(() => devicesService.initialize({ deviceId: "100" }).wait());
			});

			it("does not fail when iOSDeviceDiscovery startLookingForDevices fails", () => {
				(<any>iOSDeviceDiscovery).startLookingForDevices = (): IFuture<void> => { throw new Error("my error"); };
				assertAllMethodsResults("1");
				assert.isTrue(logger.traceOutput.indexOf("my error") !== -1);
			});

			it("does not fail when androidDeviceDiscovery startLookingForDevices fails", () => {
				(<any>androidDeviceDiscovery).startLookingForDevices = (): IFuture<void> => { throw new Error("my error"); };
				iOSDeviceDiscovery.emit("deviceFound", iOSDevice);
				devicesService.initialize({ deviceId: iOSDevice.deviceInfo.identifier }).wait();
				assert.isTrue(logger.traceOutput.indexOf("my error") !== -1);
			});
		});

		describe("when only platform is passed", () => {
			it("execute fails when platform is iOS on non-Darwin platform and there are no devices attached when --emulator is passed", () => {
				testInjector.resolve("hostInfo").isDarwin = false;
				devicesService.initialize({ platform: "ios" }).wait();
				testInjector.resolve("options").emulator = true;
				assert.throws(() => devicesService.execute(() => { counter++; return Future.fromResult(); }).wait(), "Cannot find connected devices. Reconnect any connected devices");
			});

			it("execute fails when platform is iOS on non-Darwin platform and there are no devices attached", () => {
				testInjector.resolve("hostInfo").isDarwin = false;
				devicesService.initialize({ platform: "ios" }).wait();
				assert.isFalse(devicesService.hasDevices, "MUST BE FALSE!!!");
				assert.throws(() => devicesService.execute(() => { counter++; return Future.fromResult(); }).wait(), "Cannot find connected devices. Reconnect any connected devices");
			});

			it("executes action only on iOS Simulator when iOS device is found and --emulator is passed", () => {
				testInjector.resolve("options").emulator = true;
				testInjector.resolve("hostInfo").isDarwin = true;
				iOSDeviceDiscovery.emit("deviceFound", iOSDevice);
				devicesService.initialize({ platform: "ios" }).wait();
				let deviceIdentifier: string;
				counter = 0;
				devicesService.execute((d: Mobile.IDevice) => { deviceIdentifier = d.deviceInfo.identifier; counter++; return Future.fromResult(); }).wait();
				assert.deepEqual(counter, 1, "The action must be executed on only one device. ASAAS");
				assert.deepEqual(deviceIdentifier, iOSSimulator.deviceInfo.identifier);
				counter = 0;
				devicesService.execute(() => { counter++; return Future.fromResult(); }, () => false).wait();
				assert.deepEqual(counter, 0, "The action must not be executed when canExecute returns false.");
				counter = 0;
				iOSDeviceDiscovery.emit("deviceLost", iOSDevice);
				deviceIdentifier = null;
				devicesService.execute((d: Mobile.IDevice) => { deviceIdentifier = d.deviceInfo.identifier; counter++; return Future.fromResult(); }).wait();
				assert.deepEqual(counter, 1, "The action must be executed on only one device.");
				assert.deepEqual(deviceIdentifier, iOSSimulator.deviceInfo.identifier);
				counter = 0;
				deviceIdentifier = null;
				devicesService.execute((d: Mobile.IDevice) => { deviceIdentifier = d.deviceInfo.identifier; counter++; return Future.fromResult(); }, () => false).wait();
				assert.deepEqual(counter, 0, "The action must not be executed when canExecute returns false.");
				assert.deepEqual(deviceIdentifier, null);
			});

			it("all methods work as expected", () => {
				assert.isFalse(devicesService.hasDevices, "Initially devicesService hasDevices must be false.");
				androidDeviceDiscovery.emit("deviceFound", androidDevice);
				devicesService.initialize({ platform: "android" }).wait();
				assert.deepEqual(devicesService.platform, "android");
				assert.deepEqual(devicesService.deviceCount, 1);
				androidDeviceDiscovery.emit("deviceFound", tempDevice);
				assert.isTrue(devicesService.hasDevices, "After emitting and initializing, hasDevices must be true");
				assert.deepEqual(devicesService.getDeviceInstances(), [androidDevice, tempDevice]);
				assert.deepEqual(devicesService.getDevices(), [androidDevice.deviceInfo, tempDevice.deviceInfo]);
				assert.deepEqual(devicesService.deviceCount, 2);
				counter = 0;
				devicesService.execute(() => { counter++; return Future.fromResult(); }).wait();
				assert.deepEqual(counter, 2, "The action must be executed on two devices.");
				counter = 0;
				devicesService.execute(() => { counter++; return Future.fromResult(); }, () => false).wait();
				assert.deepEqual(counter, 0, "The action must not be executed when canExecute returns false.");
				counter = 0;
				devicesService.execute(() => { counter++; return Future.fromResult(); }, () => true).wait();
				assert.deepEqual(counter, 2, "The action must be executed on two devices.");
				androidDeviceDiscovery.emit("deviceLost", androidDevice);
				counter = 0;
				devicesService.execute(() => { counter++; return Future.fromResult(); }, () => true).wait();
				assert.deepEqual(counter, 1, "The action must be executed on only one device.");
				androidDeviceDiscovery.emit("deviceLost", tempDevice);
				counter = 0;
				assertAndroidEmulatorIsStarted();
				counter = 0;
				devicesService.execute(() => { counter++; return Future.fromResult(); }, () => true, { allowNoDevices: true }).wait();
				assert.deepEqual(counter, 0, "The action must not be executed when there are no devices.");
				assert.isTrue(logger.output.indexOf(constants.ERROR_NO_DEVICES) !== -1);
				assert.isFalse(androidEmulatorServices.isStartEmulatorCalled);
			});
		});

		it("when only skipInferPlatform is passed (true)", () => {
			assert.isFalse(devicesService.hasDevices, "Initially devicesService hasDevices must be false.");
			androidDeviceDiscovery.emit("deviceFound", androidDevice);
			iOSDeviceDiscovery.emit("deviceFound", iOSDevice);
			devicesService.initialize({ skipInferPlatform: true }).wait();
			assert.deepEqual(devicesService.platform, undefined);
			assert.deepEqual(devicesService.deviceCount, 2);
			androidDeviceDiscovery.emit("deviceFound", tempDevice);
			assert.isTrue(devicesService.hasDevices, "After emitting and initializing, hasDevices must be true");
			assert.deepEqual(devicesService.getDeviceInstances(), [androidDevice, iOSDevice, tempDevice]);
			assert.deepEqual(devicesService.getDevices(), [androidDevice.deviceInfo, iOSDevice.deviceInfo, tempDevice.deviceInfo]);
			assert.deepEqual(devicesService.deviceCount, 3);
			counter = 0;
			devicesService.execute(() => { counter++; return Future.fromResult(); }).wait();
			assert.deepEqual(counter, 3, "The action must be executed on two devices.");
			counter = 0;
			devicesService.execute(() => { counter++; return Future.fromResult(); }, () => false).wait();
			assert.deepEqual(counter, 0, "The action must not be executed when canExecute returns false.");
			counter = 0;
			devicesService.execute(() => { counter++; return Future.fromResult(); }, () => true).wait();
			assert.deepEqual(counter, 3, "The action must be executed on three devices.");
			androidDeviceDiscovery.emit("deviceLost", androidDevice);
			counter = 0;
			devicesService.execute(() => { counter++; return Future.fromResult(); }, () => true).wait();
			assert.deepEqual(counter, 2, "The action must be executed on two devices.");
			androidDeviceDiscovery.emit("deviceLost", tempDevice);
			iOSDeviceDiscovery.emit("deviceLost", iOSDevice);
			counter = 0;
			assert.throws(() => devicesService.execute(() => { counter++; return Future.fromResult(); }, () => true).wait());
			counter = 0;
			devicesService.execute(() => { counter++; return Future.fromResult(); }, () => true, { allowNoDevices: true }).wait();
			assert.deepEqual(counter, 0, "The action must not be executed when there are no devices.");
			assert.isTrue(logger.output.indexOf(constants.ERROR_NO_DEVICES) !== -1);
		});

		it("when parameters are not passed and devices with same platform are detected", () => {
			assert.isFalse(devicesService.hasDevices, "Initially devicesService hasDevices must be false.");
			androidDeviceDiscovery.emit("deviceFound", androidDevice);
			devicesService.initialize().wait();
			assert.deepEqual(devicesService.platform, "android");
			assert.deepEqual(devicesService.deviceCount, 1);
			androidDeviceDiscovery.emit("deviceFound", tempDevice);
			assert.isTrue(devicesService.hasDevices, "After emitting and initializing, hasDevices must be true");
			assert.deepEqual(devicesService.getDeviceInstances(), [androidDevice, tempDevice]);
			assert.deepEqual(devicesService.getDevices(), [androidDevice.deviceInfo, tempDevice.deviceInfo]);
			assert.deepEqual(devicesService.deviceCount, 2);
			counter = 0;
			devicesService.execute(() => { counter++; return Future.fromResult(); }).wait();
			assert.deepEqual(counter, 2, "The action must be executed on two devices.");
			counter = 0;
			devicesService.execute(() => { counter++; return Future.fromResult(); }, () => false).wait();
			assert.deepEqual(counter, 0, "The action must not be executed when canExecute returns false.");
			counter = 0;
			devicesService.execute(() => { counter++; return Future.fromResult(); }, () => true).wait();
			assert.deepEqual(counter, 2, "The action must be executed on two devices.");
			androidDeviceDiscovery.emit("deviceLost", androidDevice);
			counter = 0;
			devicesService.execute(() => { counter++; return Future.fromResult(); }, () => true).wait();
			assert.deepEqual(counter, 1, "The action must be executed on only one device.");
			androidDeviceDiscovery.emit("deviceLost", tempDevice);
			counter = 0;
			assertAndroidEmulatorIsStarted();
			counter = 0;
			devicesService.execute(() => { counter++; return Future.fromResult(); }, () => true, { allowNoDevices: true }).wait();
			assert.deepEqual(counter, 0, "The action must not be executed when there are no devices.");
			assert.isTrue(logger.output.indexOf(constants.ERROR_NO_DEVICES) !== -1);
		});

		it("when parameters are not passed and devices with different platforms are detected initialize should throw", () => {
			assert.isFalse(devicesService.hasDevices, "Initially devicesService hasDevices must be false.");
			androidDeviceDiscovery.emit("deviceFound", androidDevice);
			iOSDeviceDiscovery.emit("deviceFound", iOSDevice);
			assert.throws(() => devicesService.initialize().wait());
		});

		it("when parameters are not passed and devices with invalid platforms are detected initialize should work with correct devices only", () => {
			assert.isFalse(devicesService.hasDevices, "Initially devicesService hasDevices must be false.");
			androidDeviceDiscovery.emit("deviceFound", androidDevice);
			iOSDeviceDiscovery.emit("deviceFound", {
				deviceInfo: {
					identifier: "invalid-platform-device",
					platform: "invalid-platform"
				}
			});
			devicesService.initialize().wait();
			assert.isTrue(logger.output.indexOf("is not supported") !== -1);
		});

		it("when parameters are not passed and only devices with invalid platforms are detected, initialize should throw", () => {
			assert.isFalse(devicesService.hasDevices, "Initially devicesService hasDevices must be false.");
			iOSDeviceDiscovery.emit("deviceFound", {
				deviceInfo: {
					identifier: "invalid-platform-device",
					platform: "invalid-platform"
				}
			});
			assert.throws(() => devicesService.initialize().wait());
			assert.isTrue(logger.output.indexOf("is not supported") !== -1);
		});

		it("caches execution result and does not execute next time when called", () => {
			assert.isFalse(devicesService.hasDevices, "Initially devicesService hasDevices must be false.");
			androidDeviceDiscovery.emit("deviceFound", androidDevice);
			devicesService.initialize({ platform: "android" }).wait();
			assert.deepEqual(devicesService.platform, "android");
			assert.deepEqual(devicesService.deviceCount, 1);
			devicesService.initialize({ platform: "ios" }).wait();
			assert.deepEqual(devicesService.platform, "android");
		});

		describe("when options.emulator is true on non-Darwin OS", () => {
			beforeEach(() => {
				let options = testInjector.resolve("options");
				options.emulator = true;
				let hostInfo = testInjector.resolve("hostInfo");
				hostInfo.isDarwin = false;
			});

			it("throws when iOS platform is specified and iOS device identifier is passed", () => {
				iOSDeviceDiscovery.emit("deviceFound", iOSDevice);
				assert.throws(() => devicesService.initialize({ platform: "ios", deviceId: iOSDevice.deviceInfo.identifier }).wait(), "You can use iOS simulator only on OS X.");
			});

			it("throws when iOS device identifier is passed", () => {
				iOSDeviceDiscovery.emit("deviceFound", iOSDevice);
				assert.throws(() => devicesService.initialize({ deviceId: iOSDevice.deviceInfo.identifier }).wait(), "You can use iOS simulator only on OS X.");
			});

			it("throws when iOS platform is specified", () => {
				assert.throws(() => devicesService.initialize({ platform: "ios" }).wait(), "You can use iOS simulator only on OS X.");
			});

			it("throws when paramaters are not passed, but iOS device is detected", () => {
				iOSDeviceDiscovery.emit("deviceFound", iOSDevice);
				assert.throws(() => devicesService.initialize().wait(), "You can use iOS simulator only on OS X.");
			});

			it("does not throw when only skipInferPlatform is passed", () => {
				devicesService.initialize({ skipInferPlatform: true }).wait();
			});

			it("does not throw when Android platform is specified and Android device identifier is passed", () => {
				androidDeviceDiscovery.emit("deviceFound", androidDevice);
				devicesService.initialize({ platform: "android", deviceId: androidDevice.deviceInfo.identifier }).wait();
			});
		});

		describe("does not fail on Darwin when trying to use iOS simulator", () => {
			beforeEach(() => {
				let options = testInjector.resolve("options");
				options.emulator = true;
				let hostInfo = testInjector.resolve("hostInfo");
				hostInfo.isDarwin = true;
			});

			it("when iOS platform is specified and iOS device identifier is passed", () => {
				iOSDeviceDiscovery.emit("deviceFound", iOSDevice);
				devicesService.initialize({ platform: "ios", deviceId: iOSDevice.deviceInfo.identifier }).wait();
			});

			it("when iOS device identifier is passed", () => {
				iOSDeviceDiscovery.emit("deviceFound", iOSDevice);
				devicesService.initialize({ deviceId: iOSDevice.deviceInfo.identifier }).wait();
			});

			it("when iOS platform is specified", () => {
				devicesService.initialize({ platform: "ios" }).wait();
			});

			it("when paramaters are not passed, but iOS device is detected", () => {
				iOSDeviceDiscovery.emit("deviceFound", iOSDevice);
				devicesService.initialize().wait();
			});

			it("when only skipInferPlatform is passed", () => {
				devicesService.initialize({ skipInferPlatform: true }).wait();
			});

			it("when iOS platform is specified and iOS simulator device identifier is passed", () => {
				iOSDeviceDiscovery.emit("deviceFound", iOSSimulator);
				devicesService.initialize({ platform: "ios", deviceId: iOSSimulator.deviceInfo.identifier }).wait();
			});

			it("when iOS simulator identifier is passed", () => {
				iOSDeviceDiscovery.emit("deviceFound", iOSSimulator);
				devicesService.initialize({ deviceId: iOSSimulator.deviceInfo.identifier }).wait();
			});

			it("when paramaters are not passed, but iOS simulator is detected", () => {
				iOSDeviceDiscovery.emit("deviceFound", iOSSimulator);
				devicesService.initialize().wait();
			});
		});
	});

	describe("setLogLevel", () => {
		it("calls deviceLogProvider's setLogLevel with correct arguments", () => {
			let deviceLogProvider = testInjector.resolve("deviceLogProvider");
			let actualLogLevel: string = null,
				actualDeviceIdentifier: string = null;
			deviceLogProvider.setLogLevel = (logLevel: string, deviceIdentifier?: string) => {
				actualLogLevel = logLevel;
				actualDeviceIdentifier = deviceIdentifier;
			};
			let expectedLogLevel = "expectedLogLevel",
				expectedDeviceId = "expcetedDeviceId";
			devicesService.setLogLevel(expectedLogLevel, expectedDeviceId);
			assert.deepEqual(actualLogLevel, expectedLogLevel);
			assert.deepEqual(actualDeviceIdentifier, expectedDeviceId);

			devicesService.setLogLevel(expectedLogLevel);
			assert.deepEqual(actualLogLevel, expectedLogLevel);
			assert.deepEqual(actualDeviceIdentifier, undefined);
		});
	});

	describe("deployOnDevices", () => {
		beforeEach(() => {
			androidDeviceDiscovery.emit("deviceFound", androidDevice);
			iOSDeviceDiscovery.emit("deviceFound", iOSDevice);
		});

		it("returns undefined for each device on which the app is installed", () => {
			let results = devicesService.deployOnDevices([androidDevice.deviceInfo.identifier, iOSDevice.deviceInfo.identifier], "path", "packageName", "cordova");
			assert.isTrue(results.length > 0);
			_.each(results, futurizedResult => {
				let realResult = futurizedResult.wait();
				assert.isTrue(realResult === undefined, "On success, undefined should be returned.");
			});
		});

		it("does not call startApplication when canStartApplication returns false", () => {
			iOSDevice.applicationManager.canStartApplication = () => false;
			iOSDevice.applicationManager.startApplication = (): IFuture<void> => {
				throw new Error("Start application must not be called for iOSDevice when canStartApplication returns false.");
			};
			let results = devicesService.deployOnDevices([androidDevice.deviceInfo.identifier, iOSDevice.deviceInfo.identifier], "path", "packageName", "cordova");
			assert.isTrue(results.length > 0);
			Future.wait(results);
			assert.deepEqual(results.map(r => r.get()), [undefined, undefined]);
		});

		it("throws error when invalid identifier is passed", () => {
			let results = devicesService.deployOnDevices(["invalidDeviceId", iOSDevice.deviceInfo.identifier], "path", "packageName", "cordova");
			assert.throws(() => Future.wait(results));
			_.each(results, futurizedResult => {
				let error = futurizedResult.error;
				if (error) {
					assert.isTrue(error.message.indexOf("invalidDeviceId") !== -1, "The message must contain the id of the invalid device.");
				} else {
					assert.isTrue(futurizedResult.get() === undefined, "On success, undefined should be returned.");
				}
			});
		});
	});

	describe("getDevicesForPlatform", () => {
		it("returns empty array when there are no devices", () => {
			assert.isFalse(devicesService.hasDevices, "Initially devicesService hasDevices must be false.");
			assert.deepEqual(devicesService.getDevicesForPlatform("android"), []);
			assert.deepEqual(devicesService.getDevicesForPlatform("ios"), []);
			assert.deepEqual(devicesService.getDevicesForPlatform("invalid platform"), []);
		});

		it("returns correct results when devices with different platforms are detected", () => {
			assert.isFalse(devicesService.hasDevices, "Initially devicesService hasDevices must be false.");
			androidDeviceDiscovery.emit("deviceFound", androidDevice);
			iOSDeviceDiscovery.emit("deviceFound", iOSDevice);
			let tempDeviceInstance = { deviceInfo: { identifier: "temp-device", platform: "android" } };
			androidDeviceDiscovery.emit("deviceFound", tempDeviceInstance);
			assert.deepEqual(devicesService.getDevicesForPlatform("android"), [androidDevice, tempDeviceInstance]);
			assert.deepEqual(devicesService.getDevicesForPlatform("ios"), [iOSDevice]);
			assert.deepEqual(devicesService.getDevicesForPlatform("invalid platform"), []);
		});

		it("returns correct results when devices with different platforms are detected, assert case insensitivity", () => {
			assert.isFalse(devicesService.hasDevices, "Initially devicesService hasDevices must be false.");
			androidDeviceDiscovery.emit("deviceFound", androidDevice);
			iOSDeviceDiscovery.emit("deviceFound", iOSDevice);
			let tempDeviceInstance = { deviceInfo: { identifier: "temp-device", platform: "AndroId" } };
			androidDeviceDiscovery.emit("deviceFound", tempDeviceInstance);
			assert.deepEqual(devicesService.getDevicesForPlatform("android"), [androidDevice, tempDeviceInstance]);
			assert.deepEqual(devicesService.getDevicesForPlatform("ios"), [iOSDevice]);
			assert.deepEqual(devicesService.getDevicesForPlatform("invalid platform"), []);

			assert.deepEqual(devicesService.getDevicesForPlatform("AnDroID"), [androidDevice, tempDeviceInstance]);
			assert.deepEqual(devicesService.getDevicesForPlatform("Ios"), [iOSDevice]);
			assert.deepEqual(devicesService.getDevicesForPlatform("inValid PlatForm"), []);

			assert.deepEqual(devicesService.getDevicesForPlatform("ANDROID"), [androidDevice, tempDeviceInstance]);
			assert.deepEqual(devicesService.getDevicesForPlatform("IOS"), [iOSDevice]);
			assert.deepEqual(devicesService.getDevicesForPlatform("INVALID PLATFORM"), []);
		});
	});

	describe("isAndroidDevice", () => {
		it("returns true when android device is passed", () => {
			assert.isTrue(devicesService.isAndroidDevice(<any>androidDevice));
		});

		it("returns true when android emulator is passed", () => {
			assert.isTrue(devicesService.isAndroidDevice(<any>{ deviceInfo: { platform: "android" }, isEmulator: true }));
		});

		it("returns true when android device is passed, assert case insensitivity", () => {
			assert.isTrue(devicesService.isAndroidDevice(<any>{ deviceInfo: { platform: "aNdRoId" } }));
			assert.isTrue(devicesService.isAndroidDevice(<any>{ deviceInfo: { platform: "ANDROID" } }));
		});

		it("returns false when iOS device is passed", () => {
			assert.isFalse(devicesService.isAndroidDevice(<any>iOSDevice));
			assert.isFalse(devicesService.isAndroidDevice(<any>iOSSimulator));
		});

		it("returns false when device with invalid platform is passed", () => {
			assert.isFalse(devicesService.isAndroidDevice(<any>{ deviceInfo: { platform: "invalid platform" } }));
		});
	});

	describe("isiOSDevice", () => {
		it("returns true when iOS device is passed", () => {
			assert.isTrue(devicesService.isiOSDevice(<any>iOSDevice));
		});

		it("returns true when iOS device is passed, assert case insensitivity", () => {
			assert.isTrue(devicesService.isiOSDevice(<any>{ deviceInfo: { platform: "iOs" } }));
			assert.isTrue(devicesService.isiOSDevice(<any>{ deviceInfo: { platform: "IOS" } }));
		});

		it("returns false when android device is passed", () => {
			assert.isFalse(devicesService.isiOSDevice(<any>androidDevice));
		});

		it("returns false when device with invalid platform is passed", () => {
			assert.isFalse(devicesService.isiOSDevice(<any>{ deviceInfo: { platform: "invalid platform" } }));
		});

		it("returns false when iOS emulator is passed", () => {
			assert.isFalse(devicesService.isiOSDevice(<any>iOSSimulator));
		});
	});

	describe("isiOSSimulator", () => {
		it("returns true when iOS simulator is passed", () => {
			assert.isTrue(devicesService.isiOSSimulator(<any>iOSSimulator));
		});

		it("returns true when iOS simulator is passed, assert case insensitivity", () => {
			assert.isTrue(devicesService.isiOSSimulator(<any>{ deviceInfo: { platform: "iOs" }, isEmulator: true }));
			assert.isTrue(devicesService.isiOSSimulator(<any>{ deviceInfo: { platform: "IOS" }, isEmulator: true }));
		});

		it("returns false when iOS device is passed", () => {
			assert.isFalse(devicesService.isiOSSimulator(<any>iOSDevice));
		});

		it("returns false when Androd device or Android Emulator is passed", () => {
			assert.isFalse(devicesService.isiOSSimulator(<any>androidDevice));
			assert.isFalse(devicesService.isiOSSimulator(<any>{ deviceInfo: { platform: "android" }, isEmulator: true }));
		});

		it("returns false when device with invalid platform is passed", () => {
			assert.isFalse(devicesService.isiOSSimulator(<any>{ deviceInfo: { platform: "invalid platform" } }));
		});
	});

	describe("getDeviceByDeviceOption", () => {
		it("returns undefined when devicesService is not initialized", () => {
			assert.deepEqual(devicesService.getDeviceByDeviceOption(), undefined);
		});

		it("returns undefined when devicesService is initialized with platform only", () => {
			devicesService.initialize({ platform: "android" }).wait();
			assert.deepEqual(devicesService.getDeviceByDeviceOption(), undefined);
		});

		it("returns undefined when devicesService is initialized with skipInferPlatform only", () => {
			devicesService.initialize({ skipInferPlatform: true }).wait();
			assert.deepEqual(devicesService.getDeviceByDeviceOption(), undefined);
		});

		it("returns deviceIdentifier when devicesService is initialized with deviceId only", () => {
			androidDeviceDiscovery.emit("deviceFound", androidDevice);
			devicesService.initialize({ deviceId: androidDevice.deviceInfo.identifier }).wait();
			assert.deepEqual(devicesService.getDeviceByDeviceOption(), androidDevice);
		});

		it("returns deviceIdentifier when devicesService is initialized with deviceId (passed as number)", () => {
			androidDeviceDiscovery.emit("deviceFound", androidDevice);
			devicesService.initialize({ deviceId: "1" }).wait();
			assert.deepEqual(devicesService.getDeviceByDeviceOption(), androidDevice);
		});

		it("returns deviceIdentifier when devicesService is initialized with deviceId and platform", () => {
			androidDeviceDiscovery.emit("deviceFound", androidDevice);
			devicesService.initialize({ deviceId: androidDevice.deviceInfo.identifier, platform: "android" }).wait();
			assert.deepEqual(devicesService.getDeviceByDeviceOption(), androidDevice);
		});

		it("returns deviceIdentifier when devicesService is initialized with deviceId (passed as number) and platform", () => {
			androidDeviceDiscovery.emit("deviceFound", androidDevice);
			devicesService.initialize({ deviceId: "1", platform: "android" }).wait();
			assert.deepEqual(devicesService.getDeviceByDeviceOption(), androidDevice);
		});
	});
});
