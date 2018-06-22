import { Yok } from "../../../yok";
import { AndroidEmulatorServices } from "../../../mobile/android/android-emulator-services";
import { EmulatorHelper } from "../../../mobile/emulator-helper";
import { assert } from "chai";

function createTestInjector() {
	const testInjector = new Yok();

	testInjector.register("adb", {
		getDevices: () => Promise.resolve()
	});
	testInjector.register("androidVirtualDeviceService", {});
	testInjector.register("androidGenymotionService", {});
	testInjector.register("androidEmulatorServices", AndroidEmulatorServices);
	testInjector.register("androidIniFileParser", {});
	testInjector.register("emulatorHelper", EmulatorHelper);
	testInjector.register("logger", {});
	testInjector.register("utils", {
		getMilliSecondsTimeout: () => ({})
	});

	return testInjector;
}

const avdEmulatorIds = ["emulator-5554", "emulator-5556"];
const genyEmulatorIds = ["192.168.56.101:5555", "192.168.56.102:5555"];
const avdEmulatorId = "emulator-5554";
const genyEmulatorId = "192.168.56.101:5555";

const avdEmulator = {
	identifier: "emulator-5554",
	displayName: "avd name",
	model: "model",
	version: "version",
	vendor: "Avd",
	status: "Running",
	errorHelp: "",
	isTablet: false,
	type: "type",
	platform: "android"
};

const genyEmulator = {
	identifier: "192.168.56.101:5555",
	displayName: "geny name",
	model: "model",
	version: "version",
	vendor: "Genymotion",
	status: "Running",
	errorHelp: "",
	isTablet: false,
	type: "type",
	platform: "android"
};
const mockError = "some error occurs";

describe("androidEmulatorService", () => {
	let androidEmulatorServices: Mobile.IEmulatorPlatformService = null;
	let androidVirtualDeviceService: Mobile.IAndroidVirtualDeviceService = null;
	let androidGenymotionService: Mobile.IAndroidVirtualDeviceService = null;

	beforeEach(() => {
		const testInjector = createTestInjector();
		androidEmulatorServices = testInjector.resolve("androidEmulatorServices");
		androidVirtualDeviceService = testInjector.resolve("androidVirtualDeviceService");
		androidGenymotionService = testInjector.resolve("androidGenymotionService");
	});

	function mockGetAvailableEmulators(avds: Mobile.IAvailableEmulatorsOutput, genies: Mobile.IAvailableEmulatorsOutput) {
		androidVirtualDeviceService.getAvailableEmulators = () => Promise.resolve(avds);
		androidGenymotionService.getAvailableEmulators = () => Promise.resolve(genies);
	}

	function mockGetRunningEmulatorIds(avds: string[], genies: string[]) {
		androidVirtualDeviceService.getRunningEmulatorIds = () => Promise.resolve(avds);
		androidGenymotionService.getRunningEmulatorIds = () => Promise.resolve(genies);
	}

	describe("getAvailableEmulators", () => {
		it("should return [] when there are no emulators are available", async () => {
			mockGetAvailableEmulators({devices: [], errors: []}, {devices: [], errors: []});
			const output = await androidEmulatorServices.getAvailableEmulators();
			assert.deepEqual(output.devices, []);
			assert.deepEqual(output.errors, []);
		});
		it("should return avd emulators when only avd emulators are available", async () => {
			mockGetAvailableEmulators({devices: [avdEmulator], errors: []}, {devices: [], errors: []});
			const output = await androidEmulatorServices.getAvailableEmulators();
			assert.deepEqual(output.devices, [avdEmulator]);
			assert.deepEqual(output.errors, []);
		});
		it("should return geny emulators when only geny emulators are available", async () => {
			mockGetAvailableEmulators({devices: [], errors: []}, {devices: [genyEmulator], errors: []});
			const output = await androidEmulatorServices.getAvailableEmulators();
			assert.deepEqual(output.devices, [genyEmulator]);
			assert.deepEqual(output.errors, []);
		});
		it("should return avd and geny emulators when avd and geny emulators are available", async () => {
			mockGetAvailableEmulators({devices: [avdEmulator], errors: []}, {devices: [genyEmulator], errors: []});
			const output = await androidEmulatorServices.getAvailableEmulators();
			assert.deepEqual(output.devices, [avdEmulator].concat([genyEmulator]));
			assert.deepEqual(output.errors, []);
		});
		it("should return an error when avd error is thrown", async () => {
			mockGetAvailableEmulators({devices: [], errors: [mockError]}, {devices: [], errors: []});
			const output = await androidEmulatorServices.getAvailableEmulators();
			assert.deepEqual(output.devices, []);
			assert.deepEqual(output.errors, [mockError]);
		});
		it("should return an error when geny error is thrown", async () => {
			mockGetAvailableEmulators({devices: [], errors: []}, {devices: [], errors: [mockError]});
			const output = await androidEmulatorServices.getAvailableEmulators();
			assert.deepEqual(output.devices, []);
			assert.deepEqual(output.errors, [mockError]);
		});
		it("should return an error when avd and geny errors are thrown", async () => {
			mockGetAvailableEmulators({devices: [], errors: [mockError]}, {devices: [], errors: [mockError]});
			const output = await androidEmulatorServices.getAvailableEmulators();
			assert.deepEqual(output.devices, []);
			assert.deepEqual(output.errors, [mockError, mockError]);
		});
	});

	describe("getRunningEmulatorIds", () => {
		it("should return [] when no running emulators", async () => {
			mockGetRunningEmulatorIds([], []);
			const emulatorIds = await androidEmulatorServices.getRunningEmulatorIds();
			assert.deepEqual(emulatorIds, []);
		});
		it("should return avd emulators when only avd emulators are available", async () => {
			mockGetRunningEmulatorIds(avdEmulatorIds, []);
			const emulators = await androidEmulatorServices.getRunningEmulatorIds();
			assert.deepEqual(emulators, avdEmulatorIds);
		});
		it("should return geny emulators when only geny emulators are available", async () => {
			mockGetRunningEmulatorIds([], genyEmulatorIds);
			const emulators = await androidEmulatorServices.getRunningEmulatorIds();
			assert.deepEqual(emulators, genyEmulatorIds);
		});
		it("should return avd and geny emulators are available", async () => {
			mockGetRunningEmulatorIds(avdEmulatorIds, genyEmulatorIds);
			const emulators = await androidEmulatorServices.getRunningEmulatorIds();
			assert.deepEqual(emulators, avdEmulatorIds.concat(genyEmulatorIds));
		});
	});

	describe("getRunningEmulator", () => {
		it("should return null when no emulators are available", async () => {
			const emulator = await androidEmulatorServices.getRunningEmulator("invalid", []);
			assert.deepEqual(emulator, null);
		});
		it("should return null when there are available emulators but the provided emulatorId is not found", async () => {
			const emulator = await androidEmulatorServices.getRunningEmulator("invalid", [genyEmulator]);
			assert.deepEqual(emulator, null);
		});
		it("should return avd emulator when the provided emulatorId is found", async () => {
			const emulator = await androidEmulatorServices.getRunningEmulator(avdEmulatorId, [avdEmulator]);
			assert.deepEqual(emulator, avdEmulator);
		});
		it("should return geny emulator when the provided emulatorId is found", async () => {
			const emulator = await androidEmulatorServices.getRunningEmulator(genyEmulatorId, [genyEmulator]);
			assert.deepEqual(emulator, genyEmulator);
		});
		it("should return avd emulator when there are avd and geny emulators", async () => {
			const emulator = await androidEmulatorServices.getRunningEmulator(avdEmulatorId, [avdEmulator, genyEmulator]);
			assert.deepEqual(emulator, avdEmulator);
		});
	});

	describe("startEmulator", () => {
		function mockStartEmulator(deviceInfo: Mobile.IDeviceInfo): Mobile.IDeviceInfo {
			if (deviceInfo.vendor === "Avd") {
				androidVirtualDeviceService.startEmulator = () => ({});
			} else {
				androidGenymotionService.startEmulator = () => ({});
			}

			return deviceInfo;
		}

		it("should start avd emulator", async () => {
			mockGetRunningEmulatorIds([], []);
			mockGetAvailableEmulators({devices: [avdEmulator], errors: []}, {devices: [], errors: []});
			const deviceInfo = mockStartEmulator(avdEmulator);
			await androidEmulatorServices.startEmulator(avdEmulator);
			assert.deepEqual(deviceInfo, avdEmulator);
		});
		it("should start geny emulator", async () => {
			mockGetRunningEmulatorIds([], []);
			mockGetAvailableEmulators({devices: [], errors: []}, {devices: [genyEmulator], errors: []});
			const deviceInfo = mockStartEmulator(genyEmulator);
			assert.deepEqual(deviceInfo, genyEmulator);
		});
	});
});
