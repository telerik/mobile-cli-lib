import Future = require("fibers/future");

global._ = require("lodash");
global.$injector = require("../yok").injector;
// $injector.require("config", "../lib/config");
// $injector.require("resources", "../lib/resource-loader");
$injector.require("hostInfo", "../host-info");
$injector.register("config", {});

// Our help reporting requires analyticsService. Give it this mock so that errors during test executions can be printed out
$injector.register("analyticsService", {
	checkConsent(): IFuture<void> { return Promise.resolve(); },
	trackFeature(featureName: string): IFuture<void>{ return Promise.resolve(); },
	trackException(exception: any, message: string): IFuture<void> { return Promise.resolve(); },
	setStatus(settingName: string, enabled: boolean): IFuture<void>{ return Promise.resolve(); },
	getStatusMessage(settingName: string, jsonFormat: boolean, readableSettingName: string): IFuture<string>{ return Promise.resolve("Fake message"); },
	isEnabled(settingName: string): IFuture<boolean>{ return Promise.resolve(false); },
	track(featureName: string, featureValue: string): IFuture<void>{ return Promise.resolve(); }
});

// Converts the js callstack to typescript
import errors = require("../errors");
errors.installUncaughtExceptionListener();

process.on('exit', (code: number) => {
	require("fibers/future").assertNoFutureLeftBehind();
});
