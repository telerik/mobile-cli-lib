import { CommonLoggerStub, ErrorsStub } from "./stubs";
import { Yok } from "../../yok";
import { AnalyticsServiceBase } from "../../services/analytics-service-base";
import * as os from "os";
import helpersLib = require("../../helpers");
import { HostInfo } from "../../host-info";
import { OsInfo } from "../../os-info";
let assert = require("chai").assert;

let trackedFeatureNamesAndValues = "";
let savedSettingNamesAndValues = "";
let lastTrackedExceptionMsg = "";
let lastUsedEqatecSettings: any;
let isEqatecStopCalled = false;
require("../../vendor/EqatecMonitor.min"); // note - it modifies global scope!

const cliGlobal = <ICliGlobal>global;
let originalEqatec = cliGlobal._eqatec;

function setGlobalEqatec(shouldSetUserThrowException: boolean, shouldStartThrow: boolean): void {
	cliGlobal._eqatec = {
		createSettings: (apiKey: string) => {
			return <any>{};
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
					if (shouldSetUserThrowException) {
						throw new Error("setUserID throws");
					}
				},
				start: () => {
					if (shouldStartThrow) {
						throw new Error("start throws");
					}
				},
				setStartCount: (count: number) => { /*a mock */ },
				status: () => ({ isSending: false })
			};
		},

	};
}

class UserSettingsServiceStub {
	constructor(public featureTracking: boolean,
		public exceptionsTracking: boolean,
		public testInjector: IInjector) { }

	async getSettingValue<T>(settingName: string): Promise<T | string> {
		let $staticConfig: Config.IStaticConfig = this.testInjector.resolve("staticConfig");

		if (settingName === $staticConfig.TRACK_FEATURE_USAGE_SETTING_NAME) {
			return this.featureTracking !== undefined ? this.featureTracking.toString() : undefined;
		} else if (settingName === $staticConfig.ERROR_REPORT_SETTING_NAME) {
			return this.exceptionsTracking !== undefined ? this.exceptionsTracking.toString() : undefined;
		}

		return undefined;
	}

	async saveSetting<T>(key: string, value: T): Promise<void> {
		savedSettingNamesAndValues += `${key}.${value}`;
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
	testInjector.register("analyticsService", AnalyticsServiceBase);
	testInjector.register("analyticsSettingsService", {
		canDoRequest: () => {
			return Promise.resolve(testScenario.canDoRequest);
		},
		getClientName: () => {
			return "UnitTests";
		},
		getPrivacyPolicyLink: () => {
			return "privacy policy link";
		},
		getUserId: () => {
			return Promise.resolve("UnitTestsUserId");
		},
		getUserSessionsCount: () => Promise.resolve(0),
		setUserSessionsCount: (count: number) => Promise.resolve()
	});

	testInjector.register("options", {
		analyticsClient: null
	});
	testInjector.register("prompter", {
		confirm: (message: string, defaultAction?: () => boolean) => {
			return Promise.resolve(testScenario.prompterConfirmResult);
		}
	});
	testInjector.register("staticConfig", {
		ERROR_REPORT_SETTING_NAME: "TrackExceptions",
		TRACK_FEATURE_USAGE_SETTING_NAME: "TrackFeatureUsage",
		CLIENT_NAME: "common-lib",
		ANALYTICS_API_KEY: "AnalyticsAPIKey"
	});
	testInjector.register("hostInfo", HostInfo);
	testInjector.register("osInfo", OsInfo);
	testInjector.register("userSettingsService", new UserSettingsServiceStub(testScenario.featureTracking, testScenario.exceptionsTracking, testInjector));
	testInjector.register("progressIndicator", {
		showProgressIndicator: (future: Promise<any>, timeout: number, options?: { surpressTrailingNewLine?: boolean }) => {
			return future;
		}
	});
	helpersLib.isInteractive = () => {
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
		if (service) {
			service.tryStopEqatecMonitor();
		}
	});

	after(() => {
		cliGlobal._eqatec = originalEqatec;
	});

	describe("trackFeature", () => {
		it("tracks feature when console is interactive", async () => {
			let testInjector = createTestInjector(baseTestScenario);
			service = testInjector.resolve("analyticsService");
			await service.trackFeature(featureName);
			assert.isTrue(trackedFeatureNamesAndValues.indexOf(`CLI.${featureName}`) !== -1);
			(<any>service).tryStopEqatecMonitor();
		});

		it("tracks feature when console is not interactive", async () => {
			baseTestScenario.isInteractive = false;
			let testInjector = createTestInjector(baseTestScenario);
			service = testInjector.resolve("analyticsService");
			await service.trackFeature(featureName);
			assert.isTrue(trackedFeatureNamesAndValues.indexOf(`Non-interactive.${featureName}`) !== -1);
			(<any>service).tryStopEqatecMonitor();
		});

		it("does not track feature when console is interactive and feature tracking is disabled", async () => {
			baseTestScenario.featureTracking = false;
			let testInjector = createTestInjector(baseTestScenario);
			service = testInjector.resolve("analyticsService");
			await service.trackFeature(featureName);
			assert.deepEqual(trackedFeatureNamesAndValues, "");
		});

		it("does not track feature when console is not interactive and feature tracking is disabled", async () => {
			baseTestScenario.featureTracking = baseTestScenario.isInteractive = false;
			let testInjector = createTestInjector(baseTestScenario);
			service = testInjector.resolve("analyticsService");
			await service.trackFeature(featureName);
			assert.deepEqual(trackedFeatureNamesAndValues, "");
		});

		it("does not track feature when console is interactive and feature tracking is enabled, but cannot make request", async () => {
			baseTestScenario.canDoRequest = false;
			let testInjector = createTestInjector(baseTestScenario);
			service = testInjector.resolve("analyticsService");
			await service.trackFeature(featureName);
			assert.deepEqual(trackedFeatureNamesAndValues, "");
		});

		it("does not track feature when console is not interactive and feature tracking is enabled, but cannot make request", async () => {
			baseTestScenario.canDoRequest = baseTestScenario.isInteractive = false;
			let testInjector = createTestInjector(baseTestScenario);
			service = testInjector.resolve("analyticsService");
			await service.trackFeature(featureName);
			assert.deepEqual(trackedFeatureNamesAndValues, "");
		});

		it("does not throw exception when eqatec start throws", async () => {
			baseTestScenario.shouldStartThrow = true;
			let testInjector = createTestInjector(baseTestScenario);
			service = testInjector.resolve("analyticsService");
			await service.trackFeature(featureName);
			assert.deepEqual(trackedFeatureNamesAndValues, "");
		});
	});

	describe("trackException", () => {
		let exception = "Exception";
		let message = "Track Exception Msg";
		it("tracks when all conditions are correct", async () => {
			let testInjector = createTestInjector(baseTestScenario);
			service = testInjector.resolve("analyticsService");
			await service.trackException(exception, message);
			assert.isTrue(lastTrackedExceptionMsg.indexOf(message) !== -1);
		});

		it("does not track when exception tracking is disabled", async () => {
			baseTestScenario.exceptionsTracking = false;
			let testInjector = createTestInjector(baseTestScenario);
			service = testInjector.resolve("analyticsService");
			await service.trackException(exception, message);
			assert.deepEqual(lastTrackedExceptionMsg, "");
		});

		it("does not track when feature tracking is enabled, but cannot make request", async () => {
			baseTestScenario.canDoRequest = false;
			let testInjector = createTestInjector(baseTestScenario);
			service = testInjector.resolve("analyticsService");
			await service.trackException(exception, message);
			assert.deepEqual(lastTrackedExceptionMsg, "");
		});

		it("does not throw exception when eqatec start throws", async () => {
			baseTestScenario.shouldStartThrow = true;
			let testInjector = createTestInjector(baseTestScenario);
			service = testInjector.resolve("analyticsService");
			await service.trackException(exception, message);
			assert.deepEqual(lastTrackedExceptionMsg, "");
		});
	});

	describe("track", () => {
		let name = "unitTests";
		it("tracks when all conditions are correct", async () => {
			let testInjector = createTestInjector(baseTestScenario);
			service = testInjector.resolve("analyticsService");
			await service.track(name, featureName);
			assert.isTrue(trackedFeatureNamesAndValues.indexOf(`${name}.${featureName}`) !== -1);
		});

		it("does not track when feature tracking is disabled", async () => {
			baseTestScenario.featureTracking = false;
			let testInjector = createTestInjector(baseTestScenario);
			service = testInjector.resolve("analyticsService");
			await service.track(name, featureName);
			assert.deepEqual(trackedFeatureNamesAndValues, "");
		});

		it("does not track when feature tracking is enabled, but cannot make request", async () => {
			baseTestScenario.canDoRequest = false;
			let testInjector = createTestInjector(baseTestScenario);
			service = testInjector.resolve("analyticsService");
			await service.track(name, featureName);
			assert.deepEqual(trackedFeatureNamesAndValues, "");
		});

		it("does not throw exception when eqatec start throws", async () => {
			baseTestScenario.shouldStartThrow = true;
			let testInjector = createTestInjector(baseTestScenario);
			service = testInjector.resolve("analyticsService");
			await service.track(name, featureName);
			assert.deepEqual(trackedFeatureNamesAndValues, "");
		});
	});

	describe("isEnabled", () => {
		it("returns true when analytics status is enabled", async () => {
			let testInjector = createTestInjector(baseTestScenario);
			service = testInjector.resolve("analyticsService");
			let staticConfig: Config.IStaticConfig = testInjector.resolve("staticConfig");
			assert.isTrue(await service.isEnabled(staticConfig.ERROR_REPORT_SETTING_NAME));
			assert.isTrue(await service.isEnabled(staticConfig.TRACK_FEATURE_USAGE_SETTING_NAME));
		});

		it("returns false when analytics status is disabled", async () => {
			baseTestScenario.exceptionsTracking = baseTestScenario.featureTracking = false;
			let testInjector = createTestInjector(baseTestScenario);
			service = testInjector.resolve("analyticsService");
			let staticConfig: Config.IStaticConfig = testInjector.resolve("staticConfig");
			assert.isFalse(await service.isEnabled(staticConfig.ERROR_REPORT_SETTING_NAME));
			assert.isFalse(await service.isEnabled(staticConfig.TRACK_FEATURE_USAGE_SETTING_NAME));
		});

		it("returns false when analytics status is notConfirmed", async () => {
			baseTestScenario.exceptionsTracking = baseTestScenario.featureTracking = undefined;
			let testInjector = createTestInjector(baseTestScenario);
			service = testInjector.resolve("analyticsService");
			let staticConfig: Config.IStaticConfig = testInjector.resolve("staticConfig");
			assert.isFalse(await service.isEnabled(staticConfig.ERROR_REPORT_SETTING_NAME));
			assert.isFalse(await service.isEnabled(staticConfig.TRACK_FEATURE_USAGE_SETTING_NAME));
		});
	});

	describe("setStatus", () => {
		it("sets correct status", async () => {
			let testInjector = createTestInjector(baseTestScenario);
			service = testInjector.resolve("analyticsService");
			let staticConfig: Config.IStaticConfig = testInjector.resolve("staticConfig");
			await service.setStatus(staticConfig.TRACK_FEATURE_USAGE_SETTING_NAME, false);
			assert.isTrue(savedSettingNamesAndValues.indexOf(`${staticConfig.TRACK_FEATURE_USAGE_SETTING_NAME}.false`) !== -1);
		});

		it("calls eqatec stop when all analytics trackings are disabled", async () => {
			baseTestScenario.exceptionsTracking = false;
			let testInjector = createTestInjector(baseTestScenario);
			service = testInjector.resolve("analyticsService");
			let staticConfig: Config.IStaticConfig = testInjector.resolve("staticConfig");
			// start eqatec
			await service.trackFeature(featureName);
			assert.isTrue(trackedFeatureNamesAndValues.indexOf(`CLI.${featureName}`) !== -1);
			await service.setStatus(staticConfig.TRACK_FEATURE_USAGE_SETTING_NAME, false);
			assert.isTrue(savedSettingNamesAndValues.indexOf(`${staticConfig.TRACK_FEATURE_USAGE_SETTING_NAME}.false`) !== -1);
			assert.isTrue(isEqatecStopCalled);
		});

	});

	describe("getStatusMessage", () => {
		it("returns correct string results when status is enabled", async () => {
			let testInjector = createTestInjector(baseTestScenario);
			service = testInjector.resolve("analyticsService");
			let staticConfig: Config.IStaticConfig = testInjector.resolve("staticConfig");
			let expectedMsg = "Expected result";
			assert.equal(`${expectedMsg} is enabled.`, await service.getStatusMessage(staticConfig.TRACK_FEATURE_USAGE_SETTING_NAME, false, expectedMsg));
		});

		it("returns correct string results when status is disabled", async () => {
			baseTestScenario.featureTracking = false;
			let testInjector = createTestInjector(baseTestScenario);
			service = testInjector.resolve("analyticsService");
			let staticConfig: Config.IStaticConfig = testInjector.resolve("staticConfig");
			let expectedMsg = "Expected result";
			assert.equal(`${expectedMsg} is disabled.`, await service.getStatusMessage(staticConfig.TRACK_FEATURE_USAGE_SETTING_NAME, false, expectedMsg));
		});

		it("returns correct string results when status is not confirmed", async () => {
			baseTestScenario.featureTracking = undefined;
			let testInjector = createTestInjector(baseTestScenario);
			service = testInjector.resolve("analyticsService");
			let staticConfig: Config.IStaticConfig = testInjector.resolve("staticConfig");
			let expectedMsg = "Expected result";
			assert.equal(`${expectedMsg} is disabled until confirmed.`, await service.getStatusMessage(staticConfig.TRACK_FEATURE_USAGE_SETTING_NAME, false, expectedMsg));
		});

		it("returns correct json results when status is enabled", async () => {
			let testInjector = createTestInjector(baseTestScenario);
			service = testInjector.resolve("analyticsService");
			let staticConfig: Config.IStaticConfig = testInjector.resolve("staticConfig");
			assert.deepEqual(JSON.stringify({ "enabled": true }), await service.getStatusMessage(staticConfig.TRACK_FEATURE_USAGE_SETTING_NAME, true, ""));
		});

		it("returns correct json results when status is disabled", async () => {
			baseTestScenario.featureTracking = false;
			let testInjector = createTestInjector(baseTestScenario);
			service = testInjector.resolve("analyticsService");
			let staticConfig: Config.IStaticConfig = testInjector.resolve("staticConfig");
			assert.deepEqual(JSON.stringify({ "enabled": false }), await service.getStatusMessage(staticConfig.TRACK_FEATURE_USAGE_SETTING_NAME, true, ""));
		});

		it("returns correct json results when status is not confirmed", async () => {
			baseTestScenario.featureTracking = undefined;
			let testInjector = createTestInjector(baseTestScenario);
			service = testInjector.resolve("analyticsService");
			let staticConfig: Config.IStaticConfig = testInjector.resolve("staticConfig");
			assert.deepEqual(JSON.stringify({ "enabled": null }), await service.getStatusMessage(staticConfig.TRACK_FEATURE_USAGE_SETTING_NAME, true, ""));
		});
	});

	describe("checkConsent", () => {
		it("enables feature tracking when user confirms", async () => {
			baseTestScenario.featureTracking = undefined;
			baseTestScenario.exceptionsTracking = false;
			let testInjector = createTestInjector(baseTestScenario);
			service = testInjector.resolve("analyticsService");
			await service.checkConsent();
			let staticConfig: Config.IStaticConfig = testInjector.resolve("staticConfig");
			assert.isTrue(savedSettingNamesAndValues.indexOf(`${staticConfig.TRACK_FEATURE_USAGE_SETTING_NAME}.true`) !== -1);
		});

		it("enables exception tracking when user confirms feature tracking and exception tracking is not set before that", async () => {
			baseTestScenario.featureTracking = undefined;
			baseTestScenario.exceptionsTracking = undefined;
			baseTestScenario.prompterConfirmResult = true;
			let testInjector = createTestInjector(baseTestScenario);
			service = testInjector.resolve("analyticsService");
			await service.checkConsent();
			let staticConfig: Config.IStaticConfig = testInjector.resolve("staticConfig");
			assert.isTrue(savedSettingNamesAndValues.indexOf(`${staticConfig.ERROR_REPORT_SETTING_NAME}.true`) !== -1);
		});

		it("disables feature tracking user confirms", async () => {
			baseTestScenario.featureTracking = undefined;
			baseTestScenario.prompterConfirmResult = false;
			baseTestScenario.exceptionsTracking = false;
			let testInjector = createTestInjector(baseTestScenario);
			service = testInjector.resolve("analyticsService");
			await service.checkConsent();
			let staticConfig: Config.IStaticConfig = testInjector.resolve("staticConfig");
			assert.isTrue(savedSettingNamesAndValues.indexOf(`${staticConfig.TRACK_FEATURE_USAGE_SETTING_NAME}.false`) !== -1);
		});

		it("disables exception tracking when user rejects feature tracking and exception tracking is not set before that", async () => {
			baseTestScenario.featureTracking = undefined;
			baseTestScenario.exceptionsTracking = undefined;
			baseTestScenario.prompterConfirmResult = false;

			let testInjector = createTestInjector(baseTestScenario);
			service = testInjector.resolve("analyticsService");
			await service.checkConsent();
			let staticConfig: Config.IStaticConfig = testInjector.resolve("staticConfig");
			assert.isTrue(savedSettingNamesAndValues.indexOf(`${staticConfig.ERROR_REPORT_SETTING_NAME}.false`) !== -1);
		});

		[false, true].forEach(featureTrackingValue => {
			it(`sets exception tracking to feature tracking's value when the first one is not set, but feature tracking is set to ${featureTrackingValue}`, async () => {
				baseTestScenario.featureTracking = featureTrackingValue;
				baseTestScenario.exceptionsTracking = undefined;
				let testInjector = createTestInjector(baseTestScenario);
				service = testInjector.resolve("analyticsService");
				await service.checkConsent();
				let staticConfig: Config.IStaticConfig = testInjector.resolve("staticConfig");
				assert.isTrue(savedSettingNamesAndValues.indexOf(`${staticConfig.ERROR_REPORT_SETTING_NAME}.${featureTrackingValue}`) !== -1);
			});
		});

		it("does nothing when exception and feature tracking are already set", async () => {
			baseTestScenario.featureTracking = baseTestScenario.exceptionsTracking = true;
			let testInjector = createTestInjector(baseTestScenario);
			service = testInjector.resolve("analyticsService");
			await service.checkConsent();
			assert.deepEqual(savedSettingNamesAndValues, "");
		});

		it("does nothing when cannot make request", async () => {
			baseTestScenario.canDoRequest = false;
			baseTestScenario.featureTracking = baseTestScenario.exceptionsTracking = undefined;
			let testInjector = createTestInjector(baseTestScenario);
			service = testInjector.resolve("analyticsService");
			await service.checkConsent();
			assert.deepEqual(savedSettingNamesAndValues, "");
		});

		it("does nothing when values are not set and console is not interactive", async () => {
			baseTestScenario.isInteractive = false;
			baseTestScenario.featureTracking = baseTestScenario.exceptionsTracking = undefined;
			let testInjector = createTestInjector(baseTestScenario);
			service = testInjector.resolve("analyticsService");
			await service.checkConsent();
			assert.deepEqual(savedSettingNamesAndValues, "");
		});

		it("sends information that user had accepted feature tracking", async () => {
			baseTestScenario.featureTracking = undefined;
			baseTestScenario.exceptionsTracking = false;
			let testInjector = createTestInjector(baseTestScenario);
			service = testInjector.resolve("analyticsService");
			await service.checkConsent();
			let staticConfig: Config.IStaticConfig = testInjector.resolve("staticConfig");
			assert.isTrue(trackedFeatureNamesAndValues.indexOf(`Accept${staticConfig.TRACK_FEATURE_USAGE_SETTING_NAME}.true`) !== -1);
		});

		it("sends information that user had rejected feature tracking", async () => {
			baseTestScenario.featureTracking = undefined;
			baseTestScenario.prompterConfirmResult = false;
			baseTestScenario.exceptionsTracking = false;
			let testInjector = createTestInjector(baseTestScenario);
			service = testInjector.resolve("analyticsService");
			await service.checkConsent();
			let staticConfig: Config.IStaticConfig = testInjector.resolve("staticConfig");
			assert.isTrue(trackedFeatureNamesAndValues.indexOf(`Accept${staticConfig.TRACK_FEATURE_USAGE_SETTING_NAME}.false`) !== -1);
		});
	});

	describe("uses correct settings on different os-es", () => {
		let name = "unitTests";
		let testInjector: IInjector;
		let osInfo: IOsInfo;
		let osType: () => string;
		let osRelease: () => string;
		let release = "1.0";

		beforeEach(() => {
			testInjector = createTestInjector(baseTestScenario);
			service = testInjector.resolve("analyticsService");
			osInfo = testInjector.resolve("osInfo");
			osType = osInfo.type;
			osRelease = osInfo.release;
		});

		afterEach(() => {
			osInfo.type = osType;
			osInfo.release = osRelease;
		});

		it("sets correct userAgent on Windows", async () => {
			osInfo.type = () => { return "Windows_NT"; };
			osInfo.release = () => { return release; };
			await service.track(name, featureName);
			assert.equal(lastUsedEqatecSettings.userAgent, `(Windows NT ${release})`);
		});

		it("sets correct userAgent on MacOS", async () => {
			osInfo.type = () => { return "Darwin"; };
			osInfo.release = () => { return release; };
			await service.track(name, featureName);
			assert.equal(lastUsedEqatecSettings.userAgent, `(Mac OS X ${release})`);
		});

		it("sets correct userAgent on other OSs", async () => {
			osInfo.type = () => { return "Linux"; };
			osInfo.release = () => { return release; };
			await service.track(name, featureName);
			assert.equal(lastUsedEqatecSettings.userAgent, `(Linux)`);
		});
	});
});
