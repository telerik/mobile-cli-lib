import {Yok} from "../../../yok";
import {assert} from "chai";
import { CommonLoggerStub } from "../stubs";

import { EventEmitter } from "events";
import { ProjectConstants } from "../../../appbuilder/project-constants";
import { DeviceEmitter } from "../../../appbuilder/device-emitter";

class AndroidDeviceDiscoveryMock extends EventEmitter {
	public async ensureAdbServerStarted(): Promise<void> {
		return Promise.resolve();
	}
}

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
	testInjector.register("androidDeviceDiscovery", AndroidDeviceDiscoveryMock);
	testInjector.register("iOSDeviceDiscovery", CustomEventEmitter);
	testInjector.register("iOSSimulatorDiscovery", CustomEventEmitter);
	testInjector.register("devicesService", {
		initialize: (opts: { skipInferPlatform: boolean }) => Promise.resolve()
	});
	testInjector.register("deviceLogProvider", CustomEventEmitter);
	testInjector.register("companionAppsService", {
		getAllCompanionAppIdentifiers: () => companionAppIdentifiers
	});

	testInjector.register("projectConstants", ProjectConstants);
	testInjector.register("logger", CommonLoggerStub);

	testInjector.register("deviceEmitter", DeviceEmitter);

	return testInjector;
}

describe("deviceEmitter", () => {
	let testInjector: IInjector,
		deviceEmitter: any,
		isOpenDeviceLogStreamCalled = false;

	beforeEach(() => {
		testInjector = createTestInjector();
		deviceEmitter = testInjector.resolve("deviceEmitter");
		isOpenDeviceLogStreamCalled = false;
	});

	describe("initialize", () => {
		it("does not throw when ensureAdbServerStarted throws", () => {
			let androidDeviceDiscovery = testInjector.resolve("androidDeviceDiscovery"),
				logger: CommonLoggerStub = testInjector.resolve("logger");

			androidDeviceDiscovery.ensureAdbServerStarted = () => {
				return (() => {
					throw new Error("error1");
				}).future<void>()();
			};

			let warnOutput = "";
			logger.warn = (warnMsg: string) => { warnOutput += warnMsg; };

			await deviceEmitter.initialize();
			assert.isTrue(warnOutput.indexOf("Unable to start adb server") !== -1, "When ensureAdbServerStarted throws, the string 'Unable to start adb server' must be shown as warning.");
			assert.isTrue(warnOutput.indexOf("error1") !== -1, "When ensureAdbServerStarted throws, the error message must be shown as warning.");
		});
	});

	describe("raises correct events after initialize is called:", () => {
		let androidDeviceDiscovery: EventEmitter,
			iOSDeviceDiscovery: EventEmitter,
			iOSSimulatorDiscovery: EventEmitter,
			androidDevice: any,
			iOSDevice: any,
			iOSSimulator: any;

		beforeEach(async () => {
			await deviceEmitter.initialize();
			androidDeviceDiscovery = testInjector.resolve("androidDeviceDiscovery");
			iOSDeviceDiscovery = testInjector.resolve("iOSDeviceDiscovery");
			iOSSimulatorDiscovery = testInjector.resolve("iOSSimulatorDiscovery");

			androidDevice = {
				deviceInfo: {
					"identifier": "androidDeviceId",
					"platform": "android"
				},
				applicationManager: new EventEmitter(),
				openDeviceLogStream: () => isOpenDeviceLogStreamCalled = true
			};

			iOSDevice = {
				deviceInfo: {
					"identifier": "iOSDeviceId",
					"platform": "iOS"
				},
				applicationManager: new EventEmitter(),
				openDeviceLogStream: () => isOpenDeviceLogStreamCalled = true
			};
			iOSSimulator = {
				deviceInfo: {
					"identifier": "iOSSimulatorDeviceId",
					"platform": "iOS"
				},
				applicationManager: new EventEmitter(),
				openDeviceLogStream: () => isOpenDeviceLogStreamCalled = true
			};
		});

		_.each(["deviceFound", "deviceLost"], (deviceEvent: string) => {
			describe(deviceEvent, () => {
				let attachDeviceEventVerificationHandler = (expectedDeviceInfo: any, done: mocha.Done) => {
					deviceEmitter.on(deviceEvent, (deviceInfo: Mobile.IDeviceInfo) => {
						assert.deepEqual(deviceInfo, expectedDeviceInfo);
						// Wait for all operations to be completed and call done after that.
						setTimeout(() => done(), 0);
					});
				};

				it("is raised when working with android device", (done) => {
					attachDeviceEventVerificationHandler(androidDevice.deviceInfo, done);
					androidDeviceDiscovery.emit(deviceEvent, androidDevice);
				});

				it("is raised when working with iOS device", (done) => {
					attachDeviceEventVerificationHandler(iOSDevice.deviceInfo, done);
					iOSDeviceDiscovery.emit(deviceEvent, iOSDevice);
				});

				it("is raised when working with iOS simulator", (done) => {
					attachDeviceEventVerificationHandler(iOSSimulator.deviceInfo, done);
					iOSSimulatorDiscovery.emit(deviceEvent, iOSSimulator);
				});

			});
		});

		describe("openDeviceLogStream", () => {
			let attachDeviceEventVerificationHandler = (expectedDeviceInfo: any, done: mocha.Done) => {
				deviceEmitter.on("deviceFound", (deviceInfo: Mobile.IDeviceInfo) => {
					assert.deepEqual(deviceInfo, expectedDeviceInfo);

					// Wait for all operations to be completed and call done after that.
					setTimeout(() => {
						assert.isTrue(isOpenDeviceLogStreamCalled, "When device is found, openDeviceLogStream must be called immediately.");
						done();
					}, 0);
				});
			};

			it("is called when working with android device", (done) => {
				attachDeviceEventVerificationHandler(androidDevice.deviceInfo, done);
				androidDeviceDiscovery.emit("deviceFound", androidDevice);
			});

			it("is called when working with iOS device", (done) => {
				attachDeviceEventVerificationHandler(iOSDevice.deviceInfo, done);
				iOSDeviceDiscovery.emit("deviceFound", iOSDevice);
			});

			it("is called when working with iOS simulator", (done) => {
				attachDeviceEventVerificationHandler(iOSSimulator.deviceInfo, done);
				iOSSimulatorDiscovery.emit("deviceFound", iOSSimulator);
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

				it("is called when android device reports data", (done) => {
					attachDeviceLogDataVerificationHandler(androidDevice.deviceInfo.identifier, done);
					androidDeviceDiscovery.emit("deviceFound", androidDevice);
					deviceLogProvider.emit("data", androidDevice.deviceInfo.identifier, expectedDeviceLogData);
				});

				it("is called when iOS device reports data", (done) => {
					attachDeviceLogDataVerificationHandler(iOSDevice.deviceInfo.identifier, done);
					iOSDeviceDiscovery.emit("deviceFound", iOSDevice);
					deviceLogProvider.emit("data", iOSDevice.deviceInfo.identifier, expectedDeviceLogData);
				});

				it("is called when iOS simulator reports data", (done) => {
					attachDeviceLogDataVerificationHandler(iOSSimulator.deviceInfo.identifier, done);
					iOSSimulatorDiscovery.emit("deviceFound", iOSSimulator);
					deviceLogProvider.emit("data", iOSSimulator.deviceInfo.identifier, expectedDeviceLogData);
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

				it("is raised when working with android device", (done) => {
					attachApplicationEventVerificationHandler(androidDevice.deviceInfo.identifier, done);
					androidDeviceDiscovery.emit("deviceFound", androidDevice);
					androidDevice.applicationManager.emit(applicationEvent, expectedApplicationIdentifier);
				});

				it("is raised when working with iOS device", (done) => {
					attachApplicationEventVerificationHandler(iOSDevice.deviceInfo.identifier, done);
					iOSDeviceDiscovery.emit("deviceFound", iOSDevice);
					iOSDevice.applicationManager.emit(applicationEvent, expectedApplicationIdentifier);
				});

				it("is raised when working with iOS simulator", (done) => {
					attachApplicationEventVerificationHandler(iOSSimulator.deviceInfo.identifier, done);
					iOSSimulatorDiscovery.emit("deviceFound", iOSSimulator);
					iOSSimulator.applicationManager.emit(applicationEvent, expectedApplicationIdentifier);
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

				it("is raised when working with android device", (done) => {
					let debuggableAppInfo: Mobile.IDeviceApplicationInformation = {
						appIdentifier: "app identifier",
						deviceIdentifier: androidDevice.deviceInfo.identifier,
						framework: "cordova"
					};

					attachDebuggableEventVerificationHandler(debuggableAppInfo, done);
					androidDeviceDiscovery.emit("deviceFound", androidDevice);
					androidDevice.applicationManager.emit(applicationEvent, debuggableAppInfo);
				});

				it("is raised when working with iOS device", (done) => {
					let debuggableAppInfo: Mobile.IDeviceApplicationInformation = {
						appIdentifier: "app identifier",
						deviceIdentifier: iOSDevice.deviceInfo.identifier,
						framework: "cordova"
					};

					attachDebuggableEventVerificationHandler(debuggableAppInfo, done);
					iOSDeviceDiscovery.emit("deviceFound", iOSDevice);
					iOSDevice.applicationManager.emit(applicationEvent, debuggableAppInfo);
				});

				it("is raised when working with iOS simulator", (done) => {
					let debuggableAppInfo: Mobile.IDeviceApplicationInformation = {
						appIdentifier: "app identifier",
						deviceIdentifier: iOSSimulator.deviceInfo.identifier,
						framework: "cordova"
					};

					attachDebuggableEventVerificationHandler(debuggableAppInfo, done);
					iOSSimulatorDiscovery.emit("deviceFound", iOSSimulator);
					iOSSimulator.applicationManager.emit(applicationEvent, debuggableAppInfo);
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

				it("is raised when working with android device", (done) => {
					let expectedDebuggableViewInfo: Mobile.IDebugWebViewInfo = createDebuggableWebView("test1");

					attachDebuggableEventVerificationHandler(androidDevice.deviceInfo.identifier, appId, expectedDebuggableViewInfo, done);
					androidDeviceDiscovery.emit("deviceFound", androidDevice);
					androidDevice.applicationManager.emit(applicationEvent, appId, expectedDebuggableViewInfo);
				});

				it("is raised when working with iOS device", (done) => {
					let expectedDebuggableViewInfo: Mobile.IDebugWebViewInfo = createDebuggableWebView("test1");

					attachDebuggableEventVerificationHandler(iOSDevice.deviceInfo.identifier, appId, expectedDebuggableViewInfo, done);
					iOSDeviceDiscovery.emit("deviceFound", iOSDevice);
					iOSDevice.applicationManager.emit(applicationEvent, appId, expectedDebuggableViewInfo);
				});

				it("is raised when working with iOS simulator", (done) => {
					let expectedDebuggableViewInfo: Mobile.IDebugWebViewInfo = createDebuggableWebView("test1");

					attachDebuggableEventVerificationHandler(iOSSimulator.deviceInfo.identifier, appId, expectedDebuggableViewInfo, done);
					iOSSimulatorDiscovery.emit("deviceFound", iOSSimulator);
					iOSSimulator.applicationManager.emit(applicationEvent, appId, expectedDebuggableViewInfo);
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

						it("when working with android device", (done) => {
							attachCompanionEventVerificationHandler(androidDevice.deviceInfo.identifier, done);
							androidDeviceDiscovery.emit("deviceFound", androidDevice);
							androidDevice.applicationManager.emit("applicationInstalled", companionAppIdentifersForPlatform["android"]);
							if (applicationEvent === "companionAppUninstalled") {
								androidDevice.applicationManager.emit("applicationUninstalled", companionAppIdentifersForPlatform["android"]);
							}
						});

						it("when working with iOS device", (done) => {
							attachCompanionEventVerificationHandler(iOSDevice.deviceInfo.identifier, done);
							iOSDeviceDiscovery.emit("deviceFound", iOSDevice);
							iOSDevice.applicationManager.emit("applicationInstalled", companionAppIdentifersForPlatform["ios"]);
							if (applicationEvent === "companionAppUninstalled") {
								iOSDevice.applicationManager.emit("applicationUninstalled", companionAppIdentifersForPlatform["ios"]);
							}
						});

						it("when working with iOS simulator", (done) => {
							attachCompanionEventVerificationHandler(iOSSimulator.deviceInfo.identifier, done);
							iOSSimulatorDiscovery.emit("deviceFound", iOSSimulator);
							iOSSimulator.applicationManager.emit("applicationInstalled", companionAppIdentifersForPlatform["ios"]);
							if (applicationEvent === "companionAppUninstalled") {
								iOSSimulator.applicationManager.emit("applicationUninstalled", companionAppIdentifersForPlatform["ios"]);
							}
						});
					});
				});
			});
		});

	});
});
