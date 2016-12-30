global._ = require("lodash");
global.$injector = require("../yok").injector;
// $injector.require("config", "../lib/config");
// $injector.require("resources", "../lib/resource-loader");
$injector.require("hostInfo", "../host-info");
$injector.register("config", {});

// Our help reporting requires analyticsService. Give it this mock so that errors during test executions can be printed out
$injector.register("analyticsService", {
	async checkConsent(): Promise<void> { return Promise.resolve(); },
	async trackFeature(featureName: string): Promise<void> { return Promise.resolve(); },
	async trackException(exception: any, message: string): Promise<void> { return Promise.resolve(); },
	async setStatus(settingName: string, enabled: boolean): Promise<void> { return Promise.resolve(); },
	async getStatusMessage(settingName: string, jsonFormat: boolean, readableSettingName: string): Promise<string> { return Promise.resolve("Fake message"); },
	async isEnabled(settingName: string): Promise<boolean> { return Promise.resolve(false); },
	async track(featureName: string, featureValue: string): Promise<void> { return Promise.resolve(); }
});

// Converts the js callstack to typescript
import errors = require("../errors");
errors.installUncaughtExceptionListener();

process.on('exit', (code: number) => {
	require("fibers/future").assertNoFutureLeftBehind();
});
