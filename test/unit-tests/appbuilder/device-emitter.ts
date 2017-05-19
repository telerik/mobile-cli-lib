import { Yok } from "../../../yok";
import { assert } from "chai";
import { EventEmitter } from "events";
import { ProjectConstants } from "../../../appbuilder/project-constants";
import { DeviceEmitter } from "../../../appbuilder/device-emitter";
import { DeviceDiscoveryEventNames } from "../../../constants";
// Injector dependencies must be classes.
// EventEmitter is function, so our annotate method will fail.
class CustomEventEmitter extends EventEmitter {
	constructor() { super(); }
}

let companionAppIdentifiers = {
	"cordova": {
		"android": "cordova-android",
		"ios": "cordova-ios",
		"wp8": "cordova-wp8"
	},

	"nativescript": {
		"android": "nativescript-android",
		"ios": "nativescript-ios"
	}
};

function createTestInjector(): IInjector {
	let testInjector = new Yok();
	testInjector.register("devicesService", CustomEventEmitter);
	testInjector.register("deviceLogProvider", CustomEventEmitter);
	testInjector.register("companionAppsService", {
		getAllCompanionAppIdentifiers: () => companionAppIdentifiers
	});

	testInjector.register("projectConstants", ProjectConstants);

	testInjector.register("deviceEmitter", DeviceEmitter);

	return testInjector;
}

describe("deviceEmitter", () => {
	let testInjector: IInjector,
		deviceEmitter: DeviceEmitter,
		isOpenDeviceLogStreamCalled = false;

	beforeEach(() => {
		testInjector = createTestInjector();
		deviceEmitter = testInjector.resolve("deviceEmitter");
		isOpenDeviceLogStreamCalled = false;
	});

	describe("raises correct events after initialize is called:", () => {
		let devicesService: EventEmitter,
			deviceInstance: any;

		beforeEach(async () => {
			devicesService = testInjector.resolve("devicesService");

			deviceInstance = {
				deviceInfo: {
					identifier: "deviceId",
					platform: "android"
				},
				applicationManager: new EventEmitter(),
				openDeviceLogStream: () => isOpenDeviceLogStreamCalled = true
			};
		});

		_.each([DeviceDiscoveryEventNames.DEVICE_FOUND, DeviceDiscoveryEventNames.DEVICE_LOST], deviceEvent => {
			describe(deviceEvent, () => {
				let attachDeviceEventVerificationHandler = (expectedDeviceInfo: any, done: mocha.Done) => {
					deviceEmitter.on(deviceEvent, (deviceInfo: Mobile.IDeviceInfo) => {
						assert.deepEqual(deviceInfo, expectedDeviceInfo);
						// Wait for all operations to be completed and call done after that.
						setTimeout(() => done(), 0);
					});
				};

				it("is raised when working with device", (done: mocha.Done) => {
					attachDeviceEventVerificationHandler(deviceInstance.deviceInfo, done);
					devicesService.emit(deviceEvent, deviceInstance);
				});
			});
		});

		describe("openDeviceLogStream", () => {
			let attachDeviceEventVerificationHandler = (expectedDeviceInfo: any, done: mocha.Done) => {
				deviceEmitter.on(DeviceDiscoveryEventNames.DEVICE_FOUND, (deviceInfo: Mobile.IDeviceInfo) => {
					assert.deepEqual(deviceInfo, expectedDeviceInfo);

					// Wait for all operations to be completed and call done after that.
					setTimeout(() => {
						assert.isTrue(isOpenDeviceLogStreamCalled, "When device is found, openDeviceLogStream must be called immediately.");
						done();
					}, 0);
				});
			};

			it("is called when working with device", (done: mocha.Done) => {
				attachDeviceEventVerificationHandler(deviceInstance.deviceInfo, done);
				devicesService.emit(DeviceDiscoveryEventNames.DEVICE_FOUND, deviceInstance);
			});
		});

		describe("deviceLogProvider on data", () => {
			let deviceLogProvider: EventEmitter;

			beforeEach(() => {
				deviceLogProvider = testInjector.resolve("deviceLogProvider");
			});

			describe("raises deviceLogData with correct identifier and data", () => {
				let expectedDeviceLogData = "This is some log data from device.";

				let attachDeviceLogDataVerificationHandler = (expectedDeviceIdentifier: string, done: mocha.Done) => {
					deviceEmitter.on("deviceLogData", (identifier: string, data: any) => {
						assert.deepEqual(identifier, expectedDeviceIdentifier);
						assert.deepEqual(data, expectedDeviceLogData);
						// Wait for all operations to be completed and call done after that.
						setTimeout(() => done(), 0);
					});
				};

				it("is called when device reports data", (done: mocha.Done) => {
					attachDeviceLogDataVerificationHandler(deviceInstance.deviceInfo.identifier, done);
					devicesService.emit(DeviceDiscoveryEventNames.DEVICE_FOUND, deviceInstance);
					deviceLogProvider.emit("data", deviceInstance.deviceInfo.identifier, expectedDeviceLogData);
				});
			});
		});

		_.each(["applicationInstalled", "applicationUninstalled"], (applicationEvent: string) => {
			describe(applicationEvent, () => {
				let expectedApplicationIdentifier = "application identifier";

				let attachApplicationEventVerificationHandler = (expectedDeviceIdentifier: string, done: mocha.Done) => {
					deviceEmitter.on(applicationEvent, (deviceIdentifier: string, appIdentifier: string) => {
						assert.deepEqual(deviceIdentifier, expectedDeviceIdentifier);
						assert.deepEqual(appIdentifier, expectedApplicationIdentifier);

						// Wait for all operations to be completed and call done after that.
						setTimeout(() => done(), 0);
					});
				};

				it("is raised when working with device", (done: mocha.Done) => {
					attachApplicationEventVerificationHandler(deviceInstance.deviceInfo.identifier, done);
					devicesService.emit(DeviceDiscoveryEventNames.DEVICE_FOUND, deviceInstance);
					deviceInstance.applicationManager.emit(applicationEvent, expectedApplicationIdentifier);
				});
			});
		});

		_.each(["debuggableAppFound", "debuggableAppLost"], (applicationEvent: string) => {
			describe(applicationEvent, () => {

				let attachDebuggableEventVerificationHandler = (expectedDebuggableAppInfo: Mobile.IDeviceApplicationInformation, done: mocha.Done) => {
					deviceEmitter.on(applicationEvent, (debuggableAppInfo: Mobile.IDeviceApplicationInformation) => {
						assert.deepEqual(debuggableAppInfo, expectedDebuggableAppInfo);

						// Wait for all operations to be completed and call done after that.
						setTimeout(() => done(), 0);
					});
				};

				it("is raised when working with device", (done: mocha.Done) => {
					let debuggableAppInfo: Mobile.IDeviceApplicationInformation = {
						appIdentifier: "app identifier",
						deviceIdentifier: deviceInstance.deviceInfo.identifier,
						framework: "cordova"
					};

					attachDebuggableEventVerificationHandler(debuggableAppInfo, done);
					devicesService.emit(DeviceDiscoveryEventNames.DEVICE_FOUND, deviceInstance);
					deviceInstance.applicationManager.emit(applicationEvent, debuggableAppInfo);
				});
			});
		});

		_.each(["debuggableViewFound", "debuggableViewLost", "debuggableViewChanged"], (applicationEvent: string) => {
			describe(applicationEvent, () => {

				let createDebuggableWebView = (uniqueId: string) => {
					return {
						description: `description_${uniqueId}`,
						devtoolsFrontendUrl: `devtoolsFrontendUrl_${uniqueId}`,
						id: `${uniqueId}`,
						title: `title_${uniqueId}`,
						type: `type_${uniqueId}`,
						url: `url_${uniqueId}`,
						webSocketDebuggerUrl: `webSocketDebuggerUrl_${uniqueId}`,
					};
				};

				let appId = "appId";

				let attachDebuggableEventVerificationHandler = (expectedDeviceIdentifier: string, expectedAppIdentifier: string, expectedDebuggableViewInfo: Mobile.IDebugWebViewInfo, done: mocha.Done) => {
					deviceEmitter.on(applicationEvent, (deviceIdentifier: string, appIdentifier: string, debuggableViewInfo: Mobile.IDebugWebViewInfo) => {
						assert.deepEqual(deviceIdentifier, expectedDeviceIdentifier);

						assert.deepEqual(appIdentifier, expectedAppIdentifier);

						assert.deepEqual(debuggableViewInfo, expectedDebuggableViewInfo);

						// Wait for all operations to be completed and call done after that.
						setTimeout(done, 0);
					});
				};

				it("is raised when working with device", (done: mocha.Done) => {
					let expectedDebuggableViewInfo: Mobile.IDebugWebViewInfo = createDebuggableWebView("test1");

					attachDebuggableEventVerificationHandler(deviceInstance.deviceInfo.identifier, appId, expectedDebuggableViewInfo, done);
					devicesService.emit(DeviceDiscoveryEventNames.DEVICE_FOUND, deviceInstance);
					deviceInstance.applicationManager.emit(applicationEvent, appId, expectedDebuggableViewInfo);
				});
			});
		});

		_.each(["companionAppInstalled", "companionAppUninstalled"], (applicationEvent: string) => {
			describe(applicationEvent, () => {
				_.each(companionAppIdentifiers, (companionAppIdentifersForPlatform: any, applicationFramework: string) => {
					describe(`is raised for ${applicationFramework}`, () => {
						let attachCompanionEventVerificationHandler = (expectedDeviceIdentifier: string, done: mocha.Done) => {
							deviceEmitter.on(applicationEvent, (deviceIdentifier: string, framework: string) => {
								assert.deepEqual(deviceIdentifier, expectedDeviceIdentifier);
								assert.deepEqual(framework, applicationFramework);

								// Wait for all operations to be completed and call done after that.
								setTimeout(() => done(), 0);
							});
						};

						it("when working with device", (done: mocha.Done) => {
							attachCompanionEventVerificationHandler(deviceInstance.deviceInfo.identifier, done);
							devicesService.emit(DeviceDiscoveryEventNames.DEVICE_FOUND, deviceInstance);
							deviceInstance.applicationManager.emit("applicationInstalled", companionAppIdentifersForPlatform[deviceInstance.deviceInfo.platform]);
							if (applicationEvent === "companionAppUninstalled") {
								deviceInstance.applicationManager.emit("applicationUninstalled", companionAppIdentifersForPlatform[deviceInstance.deviceInfo.platform]);
							}
						});
					});
				});
			});
		});

	});
});
