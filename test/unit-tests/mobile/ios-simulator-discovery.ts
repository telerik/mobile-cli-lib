import {IOSSimulatorDiscovery} from "../../../mobile/mobile-core/ios-simulator-discovery";
import {Yok} from "../../../yok";
import Future = require("fibers/future");
import { assert } from "chai";
import { DevicePlatformsConstants } from "../../../mobile/device-platforms-constants";

let currentlyRunningSimulator: any;

function createTestInjector(): IInjector {
	let injector = new Yok();
	injector.register("childProcess", { /* No implementation required. */ });
	injector.register("injector", injector);
	injector.register("iOSSimResolver", {
		iOSSim: {
			getRunningSimulator: () => currentlyRunningSimulator
		}
	});
	injector.register("hostInfo", {
		isDarwin: true
	});

	injector.register("devicePlatformsConstants", DevicePlatformsConstants);

	injector.register("iOSSimulatorDiscovery", IOSSimulatorDiscovery);

	injector.register("iOSSimulatorLogProvider", {});

	return injector;
}

describe("ios-simulator-discovery", () => {
	let testInjector: IInjector,
		iOSSimulatorDiscovery: Mobile.IDeviceDiscovery,
		defaultRunningSimulator: any,
		expectedDeviceInfo: Mobile.IDeviceInfo = null;

	let detectNewSimulatorAttached = (runningSimulator: any): Mobile.IiOSSimulator => {
		let future = new Future<any>();
		currentlyRunningSimulator = _.cloneDeep(runningSimulator);
		iOSSimulatorDiscovery.once("deviceFound", (device: Mobile.IDevice) => {
			future.return(device);
		});
		iOSSimulatorDiscovery.startLookingForDevices().wait();
		return future.wait();
	};

	let detectSimulatorDetached = (): Mobile.IiOSSimulator => {
		currentlyRunningSimulator = null;
		let lostDeviceFuture = new Future<Mobile.IDevice>();
		iOSSimulatorDiscovery.once("deviceLost", (device: Mobile.IDevice) => {
			lostDeviceFuture.return(device);
		});
		iOSSimulatorDiscovery.startLookingForDevices().wait();
		return lostDeviceFuture.wait();
	};

	let detectSimulatorChanged = (newId: string): any => {
		currentlyRunningSimulator.id = newId;
		let lostDeviceFuture = new Future<Mobile.IDevice>(),
			foundDeviceFuture = new Future<Mobile.IDevice>();

		iOSSimulatorDiscovery.on("deviceLost", (device: Mobile.IDevice) => {
			lostDeviceFuture.return(device);
		});

		iOSSimulatorDiscovery.on("deviceFound", (device: Mobile.IDevice) => {
			foundDeviceFuture.return(device);
		});

		iOSSimulatorDiscovery.startLookingForDevices().wait();

		let deviceLost = lostDeviceFuture.wait();
		let deviceFound = foundDeviceFuture.wait();
		return { deviceLost, deviceFound };
	};

	beforeEach(() => {
		currentlyRunningSimulator = null;
		testInjector = createTestInjector();
		iOSSimulatorDiscovery = testInjector.resolve("iOSSimulatorDiscovery");
		expectedDeviceInfo = {
			identifier: "id",
			displayName: 'name',
			model: 'c',
			version: '9.2.1',
			vendor: 'Apple',
			platform: 'iOS',
			status: 'Connected',
			errorHelp: null,
			isTablet: false,
			type: 'Emulator'
		};

		defaultRunningSimulator = {
			id: "id",
			name: "name",
			fullId: "a.b.c",
			runtimeVersion: "9.2.1",
		};
	});

	it("finds new device when it is attached", () => {
		let device = detectNewSimulatorAttached(defaultRunningSimulator);
		assert.deepEqual(device.deviceInfo, expectedDeviceInfo);
	});

	it("raises deviceLost when device is detached", () => {
		let device = detectNewSimulatorAttached(defaultRunningSimulator);
		assert.deepEqual(device.deviceInfo, expectedDeviceInfo);
		let lostDevice = detectSimulatorDetached();
		assert.deepEqual(lostDevice, device);
	});

	it("raises deviceLost and deviceFound when device's id has changed (change simulator type)", () => {
		let device = detectNewSimulatorAttached(defaultRunningSimulator),
			newId = "newId";
		assert.deepEqual(device.deviceInfo, expectedDeviceInfo);

		let devices = detectSimulatorChanged(newId);
		assert.deepEqual(devices.deviceLost, device);
		expectedDeviceInfo.identifier = newId;
		assert.deepEqual(devices.deviceFound.deviceInfo, expectedDeviceInfo);
	});

	it("raises events in correct order when simulator is started, closed and started again", () => {
		let device = detectNewSimulatorAttached(defaultRunningSimulator);
		assert.deepEqual(device.deviceInfo, expectedDeviceInfo);
		let lostDevice = detectSimulatorDetached();
		assert.deepEqual(lostDevice, device);

		device = detectNewSimulatorAttached(defaultRunningSimulator);
		assert.deepEqual(device.deviceInfo, expectedDeviceInfo);
	});

	it("finds new device when it is attached and reports it as new only once", () => {
		let device = detectNewSimulatorAttached(defaultRunningSimulator);
		assert.deepEqual(device.deviceInfo, expectedDeviceInfo);
		iOSSimulatorDiscovery.on("deviceFound", (d: Mobile.IDevice) => {
			throw new Error("Device found should not be raised for the same device.");
		});
		iOSSimulatorDiscovery.startLookingForDevices().wait();
		iOSSimulatorDiscovery.startLookingForDevices().wait();
	});

	it("does not detect devices and does not throw when getting running iOS Simulator throws", () => {
		testInjector.resolve("childProcess").exec = (command: string) => {
			return (() => {
				throw new Error("Cannot find iOS Devices.");
			}).future<any>()();
		};
		iOSSimulatorDiscovery.on("deviceFound", (device: Mobile.IDevice) => {
			throw new Error("Device found should not be raised when getting running iOS Simulator fails.");
		});
		iOSSimulatorDiscovery.startLookingForDevices().wait();
	});

	it("does not detect iOS Simulator when not running on OS X", () => {
		testInjector.resolve("hostInfo").isDarwin = false;
		iOSSimulatorDiscovery.on("deviceFound", (device: Mobile.IDevice) => {
			throw new Error("Device found should not be raised when OS is not OS X.");
		});
		iOSSimulatorDiscovery.startLookingForDevices().wait();
	});

	it("checkForDevices return future", () => {
		testInjector.resolve("hostInfo").isDarwin = false;
		iOSSimulatorDiscovery.on("deviceFound", (device: Mobile.IDevice) => {
			throw new Error("Device found should not be raised when OS is not OS X.");
		});
		iOSSimulatorDiscovery.checkForDevices().wait();
	});
});
