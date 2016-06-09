import { CommonLoggerStub, ErrorsStub } from "./stubs";
import { Yok } from "../../yok";
import { AnalyticsService } from "../../services/analytics-service";
import Future = require("fibers/future");
import * as os from "os";
import helpersLib = require("../../helpers");
import  { HostInfo } from "../../host-info";
let assert = require("chai").assert;

let trackedFeatureNamesAndValues = "";
let savedSettingNamesAndValues = "";
let lastTrackedExceptionMsg = "";
let lastUsedEqatecSettings: any;
let isEqatecStopCalled = false;
require("../../vendor/EqatecMonitor.min"); // note - it modifies global scope!
let originalEqatec = global._eqatec;

function setGlobalEqatec(shouldSetUserThrowException: boolean, shouldStartThrow: boolean): void {
	global._eqatec = {
		createSettings: (apiKey: string) => {
			return {};
		},
		createMonitor: (settings: any) => {
			lastUsedEqatecSettings = settings;
			return {
				trackFeature: (featureNameAndValue: string) => {
					trackedFeatureNamesAndValues += featureNameAndValue + os.EOL;
				},
				trackException: (exception: any, message: string) => {
					lastTrackedExceptionMsg = message;
				},
				stop: () => { isEqatecStopCalled = true; },
				setInstallationID: (guid: string) => { /*a mock*/ },
				setUserID: (userId: string) => {
					if(shouldSetUserThrowException) {
						throw new Error("setUserID throws");
					}
				},
				start: () => {
					if(shouldStartThrow) {
						throw new Error("start throws");
					}
				},
				setStartCount: (count: number) => { /*a mock */ },
				status: () => ({isSending: false})
			};
		},

	};
}

class UserSettingsServiceStub {
	constructor(public featureTracking: boolean,
		public exceptionsTracking: boolean,
		public testInjector: IInjector) {}

	getSettingValue<T>(settingName: string): IFuture<T> {
		return (() => {
			let $staticConfig: Config.IStaticConfig = this.testInjector.resolve("staticConfig");

			if(settingName === $staticConfig.TRACK_FEATURE_USAGE_SETTING_NAME) {
				return this.featureTracking !== undefined ? this.featureTracking.toString() : undefined;
			} else if(settingName === $staticConfig.ERROR_REPORT_SETTING_NAME) {
				return this.exceptionsTracking !== undefined ? this.exceptionsTracking.toString() : undefined;
			}

			return undefined;
		}).future<T>()();
	}

	saveSetting<T>(key: string, value: T): IFuture<void> {
		return (() => {
			savedSettingNamesAndValues += `${key}.${value}`;
		}).future<void>()();
	}
}

interface ITestScenario {
	canDoRequest: boolean;
	prompterConfirmResult: boolean;
	isInteractive: boolean;
	featureTracking: boolean;
	exceptionsTracking: boolean;
	shouldSetUserThrowException: boolean;
	shouldStartThrow: boolean;
}

function createTestInjector(testScenario: ITestScenario): IInjector {
	setGlobalEqatec(testScenario.shouldSetUserThrowException, testScenario.shouldStartThrow);

	let testInjector = new Yok();
	testInjector.register("logger", CommonLoggerStub);
	testInjector.register("errors", ErrorsStub);
	testInjector.register("analyticsService", AnalyticsService);
	testInjector.register("analyticsSettingsService", {
		canDoRequest: () => {
			return Future.fromResult(testScenario.canDoRequest);
		},
		getClientName: () => {
			return "UnitTests";
		},
		getPrivacyPolicyLink: () => {
			return "privacy policy link";
		},
		getUserId: () => {
			return Future.fromResult("UnitTestsUserId");
		},
		getUserSessionsCount: () => Future.fromResult(0),
		setUserSessionsCount: (count: number) => Future.fromResult()
	});

	testInjector.register("options", {
		analyticsClient: null
	});
	testInjector.register("prompter", {
		confirm: (message: string, defaultAction?: () => boolean) => {
			return Future.fromResult(testScenario.prompterConfirmResult);
		}
	});
	testInjector.register("staticConfig", {
		ERROR_REPORT_SETTING_NAME: "TrackExceptions",
		TRACK_FEATURE_USAGE_SETTING_NAME: "TrackFeatureUsage",
		CLIENT_NAME: "common-lib",
		ANALYTICS_API_KEY: "AnalyticsAPIKey"
	});
	testInjector.register("hostInfo", HostInfo);
	testInjector.register("userSettingsService",  new UserSettingsServiceStub(testScenario.featureTracking, testScenario.exceptionsTracking, testInjector));
	testInjector.register("progressIndicator", {
		showProgressIndicator: (future: IFuture<any>, timeout: number, options?: { surpressTrailingNewLine?: boolean }) => {
			return future;
		}
	});
	helpersLib.isInteractive = () =>  {
		return testScenario.isInteractive;
	};

	return testInjector;
}

describe("analytics-service", () => {
	let baseTestScenario: ITestScenario;
	let featureName = "unit tests feature";
	let service: IAnalyticsService = null;

	beforeEach(() => {
		baseTestScenario = {
			canDoRequest: true,
			featureTracking: true,
			exceptionsTracking: true,
			isInteractive: true,
			prompterConfirmResult: true,
			shouldSetUserThrowException: false,
			shouldStartThrow: false
		};
		trackedFeatureNamesAndValues = "";
		lastTrackedExceptionMsg = "";
		savedSettingNamesAndValues = "";
		isEqatecStopCalled = false;
		lastUsedEqatecSettings = {};
		service = null;
	});

	afterEach(() => {
		// clean up the process.exit event handler
		if(service) {
			service.tryStopEqatecMonitor();
		}
	});

	after(() => {
		global._eqatec = originalEqatec;
	});

	describe("trackFeature", () => {
		it("tracks feature when console is interactive", () => {
			let testInjector = createTestInjector(baseTestScenario);
			service = testInjector.resolve("analyticsService");
			service.trackFeature(featureName).wait();
			assert.isTrue(trackedFeatureNamesAndValues.indexOf(`CLI.${featureName}`) !== -1);
			(<any>service).tryStopEqatecMonitor();
		});

		it("tracks feature when console is not interactive", () => {
			baseTestScenario.isInteractive = false;
			let testInjector = createTestInjector(baseTestScenario);
			service = testInjector.resolve("analyticsService");
			service.trackFeature(featureName).wait();
			assert.isTrue(trackedFeatureNamesAndValues.indexOf(`Non-interactive.${featureName}`) !== -1);
			(<any>service).tryStopEqatecMonitor();
		});

		it("does not track feature when console is interactive and feature tracking is disabled", () => {
			baseTestScenario.featureTracking = false;
			let testInjector = createTestInjector(baseTestScenario);
			service = testInjector.resolve("analyticsService");
			service.trackFeature(featureName).wait();
			assert.deepEqual(trackedFeatureNamesAndValues, "");
		});

		it("does not track feature when console is not interactive and feature tracking is disabled", () => {
			baseTestScenario.featureTracking = baseTestScenario.isInteractive = false;
			let testInjector = createTestInjector(baseTestScenario);
			service = testInjector.resolve("analyticsService");
			service.trackFeature(featureName).wait();
			assert.deepEqual(trackedFeatureNamesAndValues, "");
		});

		it("does not track feature when console is interactive and feature tracking is enabled, but cannot make request", () => {
			baseTestScenario.canDoRequest = false;
			let testInjector = createTestInjector(baseTestScenario);
			service = testInjector.resolve("analyticsService");
			service.trackFeature(featureName).wait();
			assert.deepEqual(trackedFeatureNamesAndValues, "");
		});

		it("does not track feature when console is not interactive and feature tracking is enabled, but cannot make request", () => {
			baseTestScenario.canDoRequest = baseTestScenario.isInteractive = false;
			let testInjector = createTestInjector(baseTestScenario);
			service = testInjector.resolve("analyticsService");
			service.trackFeature(featureName).wait();
			assert.deepEqual(trackedFeatureNamesAndValues, "");
		});

		it("does not throw exception when eqatec start throws", () => {
			baseTestScenario.shouldStartThrow = true;
			let testInjector = createTestInjector(baseTestScenario);
			service = testInjector.resolve("analyticsService");
			service.trackFeature(featureName).wait();
			assert.deepEqual(trackedFeatureNamesAndValues, "");
		});
	});

	describe("trackException", () => {
		let exception = "Exception";
		let message = "Track Exception Msg";
		it("tracks when all conditions are correct", () => {
			let testInjector = createTestInjector(baseTestScenario);
			service = testInjector.resolve("analyticsService");
			service.trackException(exception, message).wait();
			assert.isTrue(lastTrackedExceptionMsg.indexOf(message) !== -1);
		});

		it("does not track when exception tracking is disabled", () => {
			baseTestScenario.exceptionsTracking = false;
			let testInjector = createTestInjector(baseTestScenario);
			service = testInjector.resolve("analyticsService");
			service.trackException(exception, message).wait();
			assert.deepEqual(lastTrackedExceptionMsg, "");
		});

		it("does not track when feature tracking is enabled, but cannot make request", () => {
			baseTestScenario.canDoRequest = false;
			let testInjector = createTestInjector(baseTestScenario);
			service = testInjector.resolve("analyticsService");
			service.trackException(exception, message).wait();
			assert.deepEqual(lastTrackedExceptionMsg, "");
		});

		it("does not throw exception when eqatec start throws", () => {
			baseTestScenario.shouldStartThrow = true;
			let testInjector = createTestInjector(baseTestScenario);
			service = testInjector.resolve("analyticsService");
			service.trackException(exception, message).wait();
			assert.deepEqual(lastTrackedExceptionMsg, "");
		});
	});

	describe("track", () => {
		let name = "unitTests";
		it("tracks when all conditions are correct", () => {
			let testInjector = createTestInjector(baseTestScenario);
			service = testInjector.resolve("analyticsService");
			service.track(name, featureName).wait();
			assert.isTrue(trackedFeatureNamesAndValues.indexOf(`${name}.${featureName}`) !== -1);
		});

		it("does not track when feature tracking is disabled", () => {
			baseTestScenario.featureTracking = false;
			let testInjector = createTestInjector(baseTestScenario);
			service = testInjector.resolve("analyticsService");
			service.track(name, featureName).wait();
			assert.deepEqual(trackedFeatureNamesAndValues, "");
		});

		it("does not track when feature tracking is enabled, but cannot make request", () => {
			baseTestScenario.canDoRequest = false;
			let testInjector = createTestInjector(baseTestScenario);
			service = testInjector.resolve("analyticsService");
			service.track(name, featureName).wait();
			assert.deepEqual(trackedFeatureNamesAndValues, "");
		});

		it("does not throw exception when eqatec start throws", () => {
			baseTestScenario.shouldStartThrow = true;
			let testInjector = createTestInjector(baseTestScenario);
			service = testInjector.resolve("analyticsService");
			service.track(name, featureName).wait();
			assert.deepEqual(trackedFeatureNamesAndValues, "");
		});
	});

	describe("isEnabled", () => {
		it("returns true when analytics status is enabled", () => {
			let testInjector = createTestInjector(baseTestScenario);
			service = testInjector.resolve("analyticsService");
			let staticConfig: Config.IStaticConfig = testInjector.resolve("staticConfig");
			assert.isTrue(service.isEnabled(staticConfig.ERROR_REPORT_SETTING_NAME).wait());
			assert.isTrue(service.isEnabled(staticConfig.TRACK_FEATURE_USAGE_SETTING_NAME).wait());
		});

		it("returns false when analytics status is disabled", () => {
			baseTestScenario.exceptionsTracking = baseTestScenario.featureTracking = false;
			let testInjector = createTestInjector(baseTestScenario);
			service = testInjector.resolve("analyticsService");
			let staticConfig: Config.IStaticConfig = testInjector.resolve("staticConfig");
			assert.isFalse(service.isEnabled(staticConfig.ERROR_REPORT_SETTING_NAME).wait());
			assert.isFalse(service.isEnabled(staticConfig.TRACK_FEATURE_USAGE_SETTING_NAME).wait());
		});

		it("returns false when analytics status is notConfirmed", () => {
			baseTestScenario.exceptionsTracking = baseTestScenario.featureTracking = undefined;
			let testInjector = createTestInjector(baseTestScenario);
			service = testInjector.resolve("analyticsService");
			let staticConfig: Config.IStaticConfig = testInjector.resolve("staticConfig");
			assert.isFalse(service.isEnabled(staticConfig.ERROR_REPORT_SETTING_NAME).wait());
			assert.isFalse(service.isEnabled(staticConfig.TRACK_FEATURE_USAGE_SETTING_NAME).wait());
		});
	});

	describe("setStatus", () => {
		it("sets correct status", () => {
			let testInjector = createTestInjector(baseTestScenario);
			service = testInjector.resolve("analyticsService");
			let staticConfig: Config.IStaticConfig = testInjector.resolve("staticConfig");
			service.setStatus(staticConfig.TRACK_FEATURE_USAGE_SETTING_NAME, false).wait();
			assert.isTrue(savedSettingNamesAndValues.indexOf(`${staticConfig.TRACK_FEATURE_USAGE_SETTING_NAME}.false`) !== -1);
		});

		it("calls eqatec stop when all analytics trackings are disabled", () => {
			baseTestScenario.exceptionsTracking = false;
			let testInjector = createTestInjector(baseTestScenario);
			service = testInjector.resolve("analyticsService");
			let staticConfig: Config.IStaticConfig = testInjector.resolve("staticConfig");
			// start eqatec
			service.trackFeature(featureName).wait();
			assert.isTrue(trackedFeatureNamesAndValues.indexOf(`CLI.${featureName}`) !== -1);
			service.setStatus(staticConfig.TRACK_FEATURE_USAGE_SETTING_NAME, false).wait();
			assert.isTrue(savedSettingNamesAndValues.indexOf(`${staticConfig.TRACK_FEATURE_USAGE_SETTING_NAME}.false`) !== -1);
			assert.isTrue(isEqatecStopCalled);
		});

		it("tracks that user had disabled feature tracking", () => {
			let testInjector = createTestInjector(baseTestScenario);
			service = testInjector.resolve("analyticsService");
			let staticConfig: Config.IStaticConfig = testInjector.resolve("staticConfig");
			service.setStatus(staticConfig.TRACK_FEATURE_USAGE_SETTING_NAME, false).wait();
			assert.isTrue(savedSettingNamesAndValues.indexOf(`${staticConfig.TRACK_FEATURE_USAGE_SETTING_NAME}.false`) !== -1);
			assert.isTrue(trackedFeatureNamesAndValues.indexOf(`${staticConfig.TRACK_FEATURE_USAGE_SETTING_NAME}.disabled`) !== -1);
		});

		it("tracks that user had enabled feature tracking", () => {
			let testInjector = createTestInjector(baseTestScenario);
			service = testInjector.resolve("analyticsService");
			let staticConfig: Config.IStaticConfig = testInjector.resolve("staticConfig");
			service.setStatus(staticConfig.TRACK_FEATURE_USAGE_SETTING_NAME, true).wait();
			assert.isTrue(savedSettingNamesAndValues.indexOf(`${staticConfig.TRACK_FEATURE_USAGE_SETTING_NAME}.true`) !== -1);
			assert.isTrue(trackedFeatureNamesAndValues.indexOf(`${staticConfig.TRACK_FEATURE_USAGE_SETTING_NAME}.enabled`) !== -1);
		});

		it("tracks that user had disabled exceptions tracking", () => {
			let testInjector = createTestInjector(baseTestScenario);
			service = testInjector.resolve("analyticsService");
			let staticConfig: Config.IStaticConfig = testInjector.resolve("staticConfig");
			service.setStatus(staticConfig.ERROR_REPORT_SETTING_NAME, false).wait();
			assert.isTrue(savedSettingNamesAndValues.indexOf(`${staticConfig.ERROR_REPORT_SETTING_NAME}.false`) !== -1);
			assert.isTrue(trackedFeatureNamesAndValues.indexOf(`${staticConfig.ERROR_REPORT_SETTING_NAME}.disabled`) !== -1);
		});

		it("tracks that user had enabled exceptions tracking", () => {
			let testInjector = createTestInjector(baseTestScenario);
			service = testInjector.resolve("analyticsService");
			let staticConfig: Config.IStaticConfig = testInjector.resolve("staticConfig");
			service.setStatus(staticConfig.ERROR_REPORT_SETTING_NAME, true).wait();
			assert.isTrue(savedSettingNamesAndValues.indexOf(`${staticConfig.ERROR_REPORT_SETTING_NAME}.true`) !== -1);
			assert.isTrue(trackedFeatureNamesAndValues.indexOf(`${staticConfig.ERROR_REPORT_SETTING_NAME}.enabled`) !== -1);
		});
	});

	describe("getStatusMessage", () => {
		it("returns correct string results when status is enabled", () => {
			let testInjector = createTestInjector(baseTestScenario);
			service = testInjector.resolve("analyticsService");
			let staticConfig: Config.IStaticConfig = testInjector.resolve("staticConfig");
			let expectedMsg = "Expected result";
			assert.equal(`${expectedMsg} is enabled.`, service.getStatusMessage(staticConfig.TRACK_FEATURE_USAGE_SETTING_NAME, false, expectedMsg).wait());
		});

		it("returns correct string results when status is disabled", () => {
			baseTestScenario.featureTracking = false;
			let testInjector = createTestInjector(baseTestScenario);
			service = testInjector.resolve("analyticsService");
			let staticConfig: Config.IStaticConfig = testInjector.resolve("staticConfig");
			let expectedMsg = "Expected result";
			assert.equal(`${expectedMsg} is disabled.`, service.getStatusMessage(staticConfig.TRACK_FEATURE_USAGE_SETTING_NAME, false, expectedMsg).wait());
		});

		it("returns correct string results when status is not confirmed", () => {
			baseTestScenario.featureTracking = undefined;
			let testInjector = createTestInjector(baseTestScenario);
			service = testInjector.resolve("analyticsService");
			let staticConfig: Config.IStaticConfig = testInjector.resolve("staticConfig");
			let expectedMsg = "Expected result";
			assert.equal(`${expectedMsg} is disabled until confirmed.`, service.getStatusMessage(staticConfig.TRACK_FEATURE_USAGE_SETTING_NAME, false, expectedMsg).wait());
		});

		it("returns correct json results when status is enabled", () => {
			let testInjector = createTestInjector(baseTestScenario);
			service = testInjector.resolve("analyticsService");
			let staticConfig: Config.IStaticConfig = testInjector.resolve("staticConfig");
			assert.deepEqual(JSON.stringify({ "enabled": true }), service.getStatusMessage(staticConfig.TRACK_FEATURE_USAGE_SETTING_NAME, true, "").wait());
		});

		it("returns correct json results when status is disabled", () => {
			baseTestScenario.featureTracking = false;
			let testInjector = createTestInjector(baseTestScenario);
			service = testInjector.resolve("analyticsService");
			let staticConfig: Config.IStaticConfig = testInjector.resolve("staticConfig");
			assert.deepEqual(JSON.stringify({ "enabled": false }), service.getStatusMessage(staticConfig.TRACK_FEATURE_USAGE_SETTING_NAME, true, "").wait());
		});

		it("returns correct json results when status is not confirmed", () => {
			baseTestScenario.featureTracking = undefined;
			let testInjector = createTestInjector(baseTestScenario);
			service = testInjector.resolve("analyticsService");
			let staticConfig: Config.IStaticConfig = testInjector.resolve("staticConfig");
			assert.deepEqual(JSON.stringify({ "enabled": null }), service.getStatusMessage(staticConfig.TRACK_FEATURE_USAGE_SETTING_NAME, true, "").wait());
		});
	});

	describe("checkConsent", () => {
		it("enables feature tracking when user confirms", () => {
			baseTestScenario.featureTracking = undefined;
			baseTestScenario.exceptionsTracking = false;
			let testInjector = createTestInjector(baseTestScenario);
			service = testInjector.resolve("analyticsService");
			service.checkConsent().wait();
			let staticConfig: Config.IStaticConfig = testInjector.resolve("staticConfig");
			assert.isTrue(savedSettingNamesAndValues.indexOf(`${staticConfig.TRACK_FEATURE_USAGE_SETTING_NAME}.true`) !== -1);
		});

		it("disables feature tracking user confirms", () => {
			baseTestScenario.featureTracking = undefined;
			baseTestScenario.prompterConfirmResult = false;
			baseTestScenario.exceptionsTracking = false;
			let testInjector = createTestInjector(baseTestScenario);
			service = testInjector.resolve("analyticsService");
			service.checkConsent().wait();
			let staticConfig: Config.IStaticConfig = testInjector.resolve("staticConfig");
			assert.isTrue(savedSettingNamesAndValues.indexOf(`${staticConfig.TRACK_FEATURE_USAGE_SETTING_NAME}.false`) !== -1);
		});

		it("enables exception tracking when it is not set", () => {
			baseTestScenario.featureTracking = false;
			baseTestScenario.exceptionsTracking = undefined;
			let testInjector = createTestInjector(baseTestScenario);
			service = testInjector.resolve("analyticsService");
			service.checkConsent().wait();
			let staticConfig: Config.IStaticConfig = testInjector.resolve("staticConfig");
			assert.isTrue(savedSettingNamesAndValues.indexOf(`${staticConfig.ERROR_REPORT_SETTING_NAME}.true`) !== -1);
		});

		it("do nothing when exception and feature tracking are already set", () => {
			baseTestScenario.featureTracking = baseTestScenario.exceptionsTracking = true;
			let testInjector = createTestInjector(baseTestScenario);
			service = testInjector.resolve("analyticsService");
			service.checkConsent().wait();
			assert.deepEqual(savedSettingNamesAndValues, "");
		});

		it("do nothing when cannot make request", () => {
			baseTestScenario.canDoRequest = false;
			baseTestScenario.featureTracking = baseTestScenario.exceptionsTracking = undefined;
			let testInjector = createTestInjector(baseTestScenario);
			service = testInjector.resolve("analyticsService");
			service.checkConsent().wait();
			assert.deepEqual(savedSettingNamesAndValues, "");
		});

		it("sends information that user had accepted feature tracking", () => {
			baseTestScenario.featureTracking = undefined;
			baseTestScenario.exceptionsTracking = false;
			let testInjector = createTestInjector(baseTestScenario);
			service = testInjector.resolve("analyticsService");
			service.checkConsent().wait();
			let staticConfig: Config.IStaticConfig = testInjector.resolve("staticConfig");
			assert.isTrue(trackedFeatureNamesAndValues.indexOf(`Accept${staticConfig.TRACK_FEATURE_USAGE_SETTING_NAME}.true`) !== -1);
		});

		it("sends information that user had rejected feature tracking", () => {
			baseTestScenario.featureTracking = undefined;
			baseTestScenario.prompterConfirmResult = false;
			baseTestScenario.exceptionsTracking = false;
			let testInjector = createTestInjector(baseTestScenario);
			service = testInjector.resolve("analyticsService");
			service.checkConsent().wait();
			let staticConfig: Config.IStaticConfig = testInjector.resolve("staticConfig");
			assert.isTrue(trackedFeatureNamesAndValues.indexOf(`Accept${staticConfig.TRACK_FEATURE_USAGE_SETTING_NAME}.false`) !== -1);
		});
	});

	describe("uses correct settings on different os-es", () => {
		let name = "unitTests";
		let testInjector: IInjector;
		let osType = os.type;
		let osRelease = os.release;
		let release = "1.0";

		beforeEach(() => {
			testInjector = createTestInjector(baseTestScenario);
			service = testInjector.resolve("analyticsService");
		});

		after(() => {
			os.type = osType;
			os.release = osRelease;
		});

		it("sets correct userAgent on Windows", () => {
			os.type = () => { return "Windows_NT"; };
			os.release = () => { return release; };
			service.track(name, featureName).wait();
			assert.equal(lastUsedEqatecSettings.userAgent, `(Windows NT ${release})`);
		});

		it("sets correct userAgent on MacOS", () => {
			os.type = () => { return "Darwin"; };
			os.release = () => { return release; };
			service.track(name, featureName).wait();
			assert.equal(lastUsedEqatecSettings.userAgent, `(Mac OS X ${release})`);
		});

		it("sets correct userAgent on other OSs", () => {
			os.type = () => { return "Linux"; };
			os.release = () => { return release; };
			service.track(name, featureName).wait();
			assert.equal(lastUsedEqatecSettings.userAgent, `(Linux)`);
		});
	});
});
