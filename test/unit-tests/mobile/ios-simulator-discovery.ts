import { IOSSimulatorDiscovery } from "../../../mobile/mobile-core/ios-simulator-discovery";
import { Yok } from "../../../yok";

import { assert } from "chai";
import { DeviceDiscoveryEventNames } from "../../../constants";
import { DevicePlatformsConstants } from "../../../mobile/device-platforms-constants";

let currentlyRunningSimulator: any;
let isCurrentlyRunning: boolean;

function createTestInjector(): IInjector {
	const injector = new Yok();
	injector.register("childProcess", {
		exec: (command: string) => Promise.resolve(isCurrentlyRunning ? 'launchd_sim' : '')
	});
	injector.register("injector", injector);
	injector.register("iOSSimResolver", {
		iOSSim: {
			getRunningSimulator: async () => currentlyRunningSimulator
		}
	});
	injector.register("hostInfo", {
		isDarwin: true
	});

	injector.register("devicePlatformsConstants", DevicePlatformsConstants);

	injector.register("mobileHelper", {
		isiOSPlatform: () => {
			return true;
		}
	});

	injector.register("iOSSimulatorDiscovery", IOSSimulatorDiscovery);

	injector.register("iOSSimulatorLogProvider", {});

	return injector;
}

describe("ios-simulator-discovery", () => {
	let testInjector: IInjector;
	let iOSSimulatorDiscovery: Mobile.IDeviceDiscovery;
	let defaultRunningSimulator: any;
	let expectedDeviceInfo: Mobile.IDeviceInfo = null;

	const detectNewSimulatorAttached = async (runningSimulator: any): Promise<Mobile.IiOSSimulator> => {
		return new Promise<Mobile.IiOSSimulator>((resolve, reject) => {

			isCurrentlyRunning = true;
			currentlyRunningSimulator = _.cloneDeep(runningSimulator);
			iOSSimulatorDiscovery.once(DeviceDiscoveryEventNames.DEVICE_FOUND, (device: Mobile.IDevice) => {
				resolve(device);
			});
			// no need to await startLookingForDevices, current promise will be resolved after execution of startLookingForDevices is completed.
			iOSSimulatorDiscovery.startLookingForDevices();
		});
	};

	const detectSimulatorDetached = async (): Promise<Mobile.IiOSSimulator> => {
		isCurrentlyRunning = false;
		currentlyRunningSimulator = null;
		return new Promise<Mobile.IDevice>((resolve, reject) => {
			iOSSimulatorDiscovery.once(DeviceDiscoveryEventNames.DEVICE_LOST, (device: Mobile.IDevice) => {
				resolve(device);
			});

			// no need to await startLookingForDevices, current promise will be resolved after execution of startLookingForDevices is completed.
			iOSSimulatorDiscovery.startLookingForDevices();
		});
	};

	const detectSimulatorChanged = async (newId: string): Promise<any> => {
		currentlyRunningSimulator.id = newId;
		let lostDevicePromise: Promise<Mobile.IDevice>;
		let foundDevicePromise: Promise<Mobile.IDevice>;

		iOSSimulatorDiscovery.on(DeviceDiscoveryEventNames.DEVICE_LOST, (device: Mobile.IDevice) => {
			lostDevicePromise = Promise.resolve(device);
		});

		iOSSimulatorDiscovery.on(DeviceDiscoveryEventNames.DEVICE_FOUND, (device: Mobile.IDevice) => {
			foundDevicePromise = Promise.resolve(device);
		});

		await iOSSimulatorDiscovery.startLookingForDevices();

		const deviceLost = await lostDevicePromise;
		const deviceFound = await foundDevicePromise;
		return { deviceLost, deviceFound };
	};

	beforeEach(() => {
		isCurrentlyRunning = false;
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

	it("finds new device when it is attached", async () => {
		const device = await detectNewSimulatorAttached(defaultRunningSimulator);
		assert.deepEqual(device.deviceInfo, expectedDeviceInfo);
	});

	it("raises deviceLost when device is detached", async () => {
		const device = await detectNewSimulatorAttached(defaultRunningSimulator);
		assert.deepEqual(device.deviceInfo, expectedDeviceInfo);
		const lostDevice = await detectSimulatorDetached();
		assert.deepEqual(lostDevice, device);
	});

	it("raises deviceLost and deviceFound when device's id has changed (change simulator type)", async () => {
		const device = await detectNewSimulatorAttached(defaultRunningSimulator),
			newId = "newId";
		assert.deepEqual(device.deviceInfo, expectedDeviceInfo);

		const devices = await detectSimulatorChanged(newId);
		assert.deepEqual(devices.deviceLost, device);
		expectedDeviceInfo.identifier = newId;
		assert.deepEqual(devices.deviceFound.deviceInfo, expectedDeviceInfo);
	});

	it("raises events in correct order when simulator is started, closed and started again", async () => {
		let device = await detectNewSimulatorAttached(defaultRunningSimulator);
		assert.deepEqual(device.deviceInfo, expectedDeviceInfo);
		const lostDevice = await detectSimulatorDetached();
		assert.deepEqual(lostDevice, device);

		device = await detectNewSimulatorAttached(defaultRunningSimulator);
		assert.deepEqual(device.deviceInfo, expectedDeviceInfo);
	});

	it("finds new device when it is attached and reports it as new only once", async () => {
		const device = await detectNewSimulatorAttached(defaultRunningSimulator);
		assert.deepEqual(device.deviceInfo, expectedDeviceInfo);
		iOSSimulatorDiscovery.on(DeviceDiscoveryEventNames.DEVICE_FOUND, (d: Mobile.IDevice) => {
			throw new Error("Device found should not be raised for the same device.");
		});

		await iOSSimulatorDiscovery.startLookingForDevices();
		await iOSSimulatorDiscovery.startLookingForDevices();
	});

	it("does not detect devices and does not throw when getting running iOS Simulator throws", async () => {
		testInjector.resolve("childProcess").exec = async (command: string) => {
			throw new Error("Cannot find iOS Devices.");
		};

		isCurrentlyRunning = true;

		iOSSimulatorDiscovery.on(DeviceDiscoveryEventNames.DEVICE_FOUND, (device: Mobile.IDevice) => {
			throw new Error("Device found should not be raised when getting running iOS Simulator fails.");
		});

		await iOSSimulatorDiscovery.startLookingForDevices();
	});

	it("does not detect iOS Simulator when not running on OS X", async () => {
		testInjector.resolve("hostInfo").isDarwin = false;
		isCurrentlyRunning = true;

		iOSSimulatorDiscovery.on(DeviceDiscoveryEventNames.DEVICE_FOUND, (device: Mobile.IDevice) => {
			throw new Error("Device found should not be raised when OS is not OS X.");
		});

		await iOSSimulatorDiscovery.startLookingForDevices();
	});

	it("checkForDevices return future", async () => {
		testInjector.resolve("hostInfo").isDarwin = false;
		isCurrentlyRunning = true;
		iOSSimulatorDiscovery.on(DeviceDiscoveryEventNames.DEVICE_FOUND, (device: Mobile.IDevice) => {
			throw new Error("Device found should not be raised when OS is not OS X.");
		});
		await iOSSimulatorDiscovery.checkForDevices();
	});
});
