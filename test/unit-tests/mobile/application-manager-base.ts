import {Yok} from "../../../yok";
import {assert} from "chai";
import { CommonLoggerStub } from "../stubs";
import { ApplicationManagerBase } from "../../../mobile/application-manager-base";
import Future = require("fibers/future");

let currentlyAvailableAppsForDebugging: Mobile.IDeviceApplicationInformation[],
	currentlyInstalledApps: string[];

class ApplicationManager extends ApplicationManagerBase {
	constructor($logger: ILogger) {
		super($logger);
	}

	public isLiveSyncSupported(appIdentifier: string): IFuture<boolean> {
		return Future.fromResult(true);
	}

	public installApplication(packageFilePath: string): IFuture<void> {
		return Future.fromResult();
	}

	public uninstallApplication(appIdentifier: string): IFuture<void> {
		return Future.fromResult();
	}

	public startApplication(appIdentifier: string, framework?: string): IFuture<void> {
		return Future.fromResult();
	}

	public stopApplication(appIdentifier: string): IFuture<void> {
		return Future.fromResult();
	}

	public getInstalledApplications(): IFuture<string[]> {
		return Future.fromResult(_.cloneDeep(currentlyInstalledApps));
	}

	public getApplicationInfo(applicationIdentifier: string): IFuture<Mobile.IApplicationInfo> {
		return Future.fromResult(null);
	}

	public canStartApplication(): boolean {
		return true;
	}

	public getDebuggableApps(): IFuture<Mobile.IDeviceApplicationInformation[]> {
		return Future.fromResult(currentlyAvailableAppsForDebugging);
	}
}

function createTestInjector(): IInjector {
	let testInjector = new Yok();
	testInjector.register("logger", CommonLoggerStub);
	testInjector.register("applicationManager", ApplicationManager);
	return testInjector;
}

function createAppsAvailableForDebugging(count: number): Mobile.IDeviceApplicationInformation[] {
	return _.times(count, (index: number) => ({
		deviceIdentifier: "deviceId",
		appIdentifier: `appId_${index}`,
		framework: "framework"
	}));
}

describe("ApplicationManagerBase", () => {
	let applicationManager: ApplicationManager,
		testInjector: IInjector;

	beforeEach(() => {
		testInjector = createTestInjector();
		currentlyAvailableAppsForDebugging = null;
		applicationManager = testInjector.resolve("applicationManager");
	});

	describe("checkForApplicationUpdates", () => {
		describe("debuggableApps", () => {
			it("emits debuggableAppFound when new application is available for debugging", (done) => {
				currentlyAvailableAppsForDebugging = createAppsAvailableForDebugging(2);
				let foundAppsForDebug: Mobile.IDeviceApplicationInformation[] = [];

				applicationManager.on("debuggableAppFound", (d: Mobile.IDeviceApplicationInformation) => {
					foundAppsForDebug.push(d);
					if (foundAppsForDebug.length === currentlyAvailableAppsForDebugging.length) {
						_.each(foundAppsForDebug, (f: Mobile.IDeviceApplicationInformation, index: number) => {
							assert.deepEqual(f, currentlyAvailableAppsForDebugging[index]);
						});
						done();
					}
				});

				applicationManager.checkForApplicationUpdates().wait();
			});

			it("emits debuggableAppFound when new application is available for debugging (several calls)", (done) => {
				currentlyAvailableAppsForDebugging = createAppsAvailableForDebugging(1);
				let foundAppsForDebug: Mobile.IDeviceApplicationInformation[] = [],
					isFinalCheck = false;

				applicationManager.on("debuggableAppFound", (d: Mobile.IDeviceApplicationInformation) => {
					foundAppsForDebug.push(d);
					if (foundAppsForDebug.length === currentlyAvailableAppsForDebugging.length) {
						_.each(foundAppsForDebug, (f: Mobile.IDeviceApplicationInformation, index: number) => {
							assert.deepEqual(f, currentlyAvailableAppsForDebugging[index]);
						});

						if (isFinalCheck) {
							done();
						}
					}
				});

				applicationManager.checkForApplicationUpdates().wait();
				currentlyAvailableAppsForDebugging = createAppsAvailableForDebugging(2);
				applicationManager.checkForApplicationUpdates().wait();
				currentlyAvailableAppsForDebugging = createAppsAvailableForDebugging(4);
				isFinalCheck = true;
				applicationManager.checkForApplicationUpdates().wait();
			});

			it("emits debuggableAppLost when application cannot be debugged anymore", (done) => {
				currentlyAvailableAppsForDebugging = createAppsAvailableForDebugging(2);
				let expectedAppsToBeLost = currentlyAvailableAppsForDebugging,
					lostAppsForDebug: Mobile.IDeviceApplicationInformation[] = [];

				applicationManager.on("debuggableAppLost", (d: Mobile.IDeviceApplicationInformation) => {
					lostAppsForDebug.push(d);

					if (lostAppsForDebug.length === expectedAppsToBeLost.length) {
						_.each(lostAppsForDebug, (f: Mobile.IDeviceApplicationInformation, index: number) => {
							assert.deepEqual(f, expectedAppsToBeLost[index]);
						});

						done();
					}
				});

				// First call will raise debuggableAppFound two times.
				applicationManager.checkForApplicationUpdates().wait();
				currentlyAvailableAppsForDebugging = [];
				// This call should raise debuggableAppLost two times.
				applicationManager.checkForApplicationUpdates().wait();
			});

			it("emits debuggableAppLost when application cannot be debugged anymore (several calls)", (done) => {
				currentlyAvailableAppsForDebugging = createAppsAvailableForDebugging(4);
				let lostAppsForDebug: Mobile.IDeviceApplicationInformation[] = [],
					isFinalCheck = false,
					initialAppsAvailableForDebug = currentlyAvailableAppsForDebugging;

				applicationManager.on("debuggableAppLost", (d: Mobile.IDeviceApplicationInformation) => {
					lostAppsForDebug.push(d);
					_.each(lostAppsForDebug, (f: Mobile.IDeviceApplicationInformation, index: number) => {
						assert.deepEqual(f, _.find(initialAppsAvailableForDebug, t => t.appIdentifier === f.appIdentifier));
					});

					if (lostAppsForDebug.length === initialAppsAvailableForDebug.length && isFinalCheck) {
						done();
					}
				});

				applicationManager.checkForApplicationUpdates().wait();
				currentlyAvailableAppsForDebugging = createAppsAvailableForDebugging(2);
				applicationManager.checkForApplicationUpdates().wait();
				currentlyAvailableAppsForDebugging = createAppsAvailableForDebugging(0);
				isFinalCheck = true;
				applicationManager.checkForApplicationUpdates().wait();
			});

			it("emits debuggableAppFound and debuggableAppLost when applications are changed", () => {
				let allAppsForDebug = createAppsAvailableForDebugging(4);
				currentlyAvailableAppsForDebugging = _.take(allAppsForDebug, 2);
				let remainingAppsForDebugging = _.difference(allAppsForDebug, currentlyAvailableAppsForDebugging);

				let foundAppsForDebug: Mobile.IDeviceApplicationInformation[] = [],
					futures: IFuture<void>[] = [];

				// This will raise debuggableAppFound 2 times.
				applicationManager.checkForApplicationUpdates().wait();

				let foundAppsFuture = new Future<void>();
				futures.push(foundAppsFuture);

				applicationManager.on("debuggableAppFound", (d: Mobile.IDeviceApplicationInformation) => {
					foundAppsForDebug.push(d);
					if (foundAppsForDebug.length === remainingAppsForDebugging.length) {
						_.each(foundAppsForDebug, (f: Mobile.IDeviceApplicationInformation, index: number) => {
							assert.deepEqual(f, remainingAppsForDebugging[index]);
						});

						foundAppsFuture.return();
					}
				});

				let lostAppsFuture = new Future<void>();
				futures.push(lostAppsFuture);

				applicationManager.on("debuggableAppLost", (d: Mobile.IDeviceApplicationInformation) => {
					assert.deepEqual(d, allAppsForDebug[0], "Debuggable app lost does not match.");
					lostAppsFuture.return();
				});

				currentlyAvailableAppsForDebugging = _.drop(allAppsForDebug, 1);
				applicationManager.checkForApplicationUpdates().wait();
				Future.wait(futures);
			});
		});

		describe("installed and uninstalled apps", () => {
			it("reports installed applications when initially there are apps", () => {
				currentlyInstalledApps = ["app1", "app2", "app3"];

				let reportedInstalledApps: string[] = [],
					future = new Future<void>();

				applicationManager.on("applicationInstalled", (app: string) => {
					reportedInstalledApps.push(app);
					if (reportedInstalledApps.length === currentlyInstalledApps.length) {
						future.return();
					}
				});

				applicationManager.checkForApplicationUpdates().wait();
				future.wait();

				_.each(currentlyInstalledApps, (c: string, index: number) => {
					assert.deepEqual(c, reportedInstalledApps[index]);
				});

				assert.deepEqual(reportedInstalledApps.length, currentlyInstalledApps.length);
			});

			it("reports installed applications when apps are changed between executions", () => {
				currentlyInstalledApps = ["app1", "app2", "app3"];

				let reportedInstalledApps: string[] = [],
					future: IFuture<void>;

				applicationManager.on("applicationInstalled", (app: string) => {
					reportedInstalledApps.push(app);
					if (reportedInstalledApps.length === currentlyInstalledApps.length) {
						future.return();
					}
				});

				let testInstalledAppsResults = () => {
					future = new Future<void>();
					applicationManager.checkForApplicationUpdates().wait();
					future.wait();

					_.each(currentlyInstalledApps, (c: string, index: number) => {
						assert.deepEqual(c, reportedInstalledApps[index]);
					});

					assert.deepEqual(reportedInstalledApps.length, currentlyInstalledApps.length);
				};
				testInstalledAppsResults();

				currentlyInstalledApps.push("app4", "app5");
				testInstalledAppsResults();

				currentlyInstalledApps.push("app6", "app7");
				testInstalledAppsResults();
			});

			it("reports uninstalled applications when initially there are apps and all are uninstalled", () => {
				currentlyInstalledApps = ["app1", "app2", "app3"];

				let reportedUninstalledApps: string[] = [],
					initiallyInstalledApps = _.cloneDeep(currentlyInstalledApps),
					future = new Future<void>();
				applicationManager.checkForApplicationUpdates().wait();
				currentlyInstalledApps = [];

				applicationManager.on("applicationUninstalled", (app: string) => {
					reportedUninstalledApps.push(app);
					if (reportedUninstalledApps.length === initiallyInstalledApps.length) {
						future.return();
					}
				});

				applicationManager.checkForApplicationUpdates().wait();
				future.wait();

				_.each(initiallyInstalledApps, (c: string, index: number) => {
					assert.deepEqual(c, reportedUninstalledApps[index]);
				});

				assert.deepEqual(reportedUninstalledApps.length, initiallyInstalledApps.length);
			});

			it("reports uninstalled applications when apps are changed between executions", () => {
				currentlyInstalledApps = ["app1", "app2", "app3", "app4", "app5", "app6"];

				let reportedUninstalledApps: string[] = [],
					removedApps: string[] = [],
					future: IFuture<void>;

				// Initialize - all apps are marked as installed.
				applicationManager.checkForApplicationUpdates().wait();
				applicationManager.on("applicationUninstalled", (app: string) => {
					reportedUninstalledApps.push(app);
					if (reportedUninstalledApps.length === removedApps.length) {
						future.return();
					}
				});

				let testInstalledAppsResults = () => {
					future = new Future<void>();
					applicationManager.checkForApplicationUpdates().wait();
					future.wait();

					_.each(removedApps, (c: string, index: number) => {
						assert.deepEqual(c, reportedUninstalledApps[index]);
					});

					assert.deepEqual(reportedUninstalledApps.length, removedApps.length);
				};

				while (currentlyInstalledApps.length) {
					let currentlyRemovedApps = currentlyInstalledApps.splice(0, 2);
					removedApps.push(...currentlyRemovedApps);
					testInstalledAppsResults();
				}
			});

			it("reports installed and uninstalled apps when apps are changed between executions", () => {
				currentlyInstalledApps = ["app1", "app2", "app3", "app4", "app5", "app6"];

				let reportedUninstalledApps: string[] = [],
					reportedInstalledApps: string[] = [],
					installedApps: string[] = [],
					removedApps: string[] = [],
					appUninstalledFuture: IFuture<void>,
					appInstalledFuture: IFuture<void>,
					waitForAppInstalledFuture = true;

				// Initialize - all apps are marked as installed.
				applicationManager.checkForApplicationUpdates().wait();
				applicationManager.on("applicationUninstalled", (app: string) => {
					reportedUninstalledApps.push(app);
					if (reportedUninstalledApps.length === removedApps.length) {
						appUninstalledFuture.return();
					}
				});

				applicationManager.on("applicationInstalled", (app: string) => {
					reportedInstalledApps.push(app);
					if (reportedInstalledApps.length === installedApps.length) {
						appInstalledFuture.return();
					}
				});

				let testInstalledAppsResults = () => {
					appInstalledFuture = new Future<void>();
					appUninstalledFuture = new Future<void>();
					applicationManager.checkForApplicationUpdates().wait();

					if (!waitForAppInstalledFuture) {
						appInstalledFuture.return();
					}

					Future.wait([appInstalledFuture, appUninstalledFuture]);

					_.each(removedApps, (c: string, index: number) => {
						assert.deepEqual(c, reportedUninstalledApps[index]);
					});

					assert.deepEqual(reportedUninstalledApps.length, removedApps.length);

					_.each(installedApps, (c: string, index: number) => {
						assert.deepEqual(c, reportedInstalledApps[index]);
					});

					assert.deepEqual(reportedInstalledApps.length, installedApps.length);
				};

				for (let index = 10; index < 13; index++) {
					let currentlyRemovedApps = currentlyInstalledApps.splice(0, 2);
					removedApps.push(...currentlyRemovedApps);

					let currentlyAddedApps = [`app${index}`];
					currentlyInstalledApps.push(...currentlyAddedApps);
					installedApps.push(...currentlyAddedApps);

					testInstalledAppsResults();
				}
			});
		});
	});

	describe("isApplicationInstalled", () => {
		it("returns true when app is installed", () => {
			currentlyInstalledApps = ["app1", "app2"];
			assert.isTrue(applicationManager.isApplicationInstalled("app1").wait(), "app1 is installed, so result of isAppInstalled must be true.");
			assert.isTrue(applicationManager.isApplicationInstalled("app2").wait(), "app2 is installed, so result of isAppInstalled must be true.");
		});

		it("returns false when app is NOT installed", () => {
			currentlyInstalledApps = ["app1", "app2"];
			assert.isFalse(applicationManager.isApplicationInstalled("app3").wait(), "app3 is NOT installed, so result of isAppInstalled must be false.");
			assert.isFalse(applicationManager.isApplicationInstalled("app4").wait(), "app4 is NOT installed, so result of isAppInstalled must be false.");
		});
	});

	describe("restartApplication", () => {
		it("calls stopApplication with correct arguments", () => {
			let stopApplicationParam: string;
			applicationManager.stopApplication = (appId: string) => {
				stopApplicationParam = appId;
				return Future.fromResult();
			};

			applicationManager.restartApplication("appId").wait();
			assert.deepEqual(stopApplicationParam, "appId", "When bundleIdentifier is not passed to restartApplication, stopApplication must be called with application identifier.");

			applicationManager.restartApplication("appId", "bundleIdentifier").wait();
			assert.deepEqual(stopApplicationParam, "bundleIdentifier", "When bundleIdentifier is passed to restartApplication, stopApplication must be called with bundleIdentifier.");
		});

		it("calls startApplication with correct arguments", () => {
			let startApplicationAppIdParam: string,
				startApplicationFrameworkParam: string;
			applicationManager.startApplication = (appId: string, framework: string) => {
				startApplicationAppIdParam = appId;
				startApplicationFrameworkParam = framework;
				return Future.fromResult();
			};

			applicationManager.restartApplication("appId").wait();
			assert.deepEqual(startApplicationAppIdParam, "appId", "startApplication must be called with application identifier.");
			assert.deepEqual(startApplicationFrameworkParam, undefined, "When framework is not passed to restartApplication, startApplication must be called with undefined framework.");

			applicationManager.restartApplication("appId", null, "cordova").wait();
			assert.deepEqual(startApplicationAppIdParam, "appId", "startApplication must be called with application identifier.");
			assert.deepEqual(startApplicationFrameworkParam, "cordova", "When framework is passed to restartApplication, startApplication must be called with this framework.");
		});

		it("calls stopApplication and startApplication in correct order", () => {
			let isStartApplicationCalled = false,
				isStopApplicationCalled = false;

			applicationManager.stopApplication = (appId: string) => {
				isStopApplicationCalled = true;
				return Future.fromResult();
			};

			applicationManager.startApplication = (appId: string, framework: string) => {
				assert.isTrue(isStopApplicationCalled, "When startApplication is called, stopApplication must have been resolved.");
				isStartApplicationCalled = true;
				return Future.fromResult();
			};

			applicationManager.restartApplication("appId").wait();
			assert.isTrue(isStopApplicationCalled, "stopApplication must be called.");
			assert.isTrue(isStartApplicationCalled, "startApplication must be called.");
		});
	});

	describe("tryStartApplication", () => {
		it("calls startApplication, when application is installed and canStartApplication returns true", () => {
			let startApplicationAppIdParam: string,
				startApplicationFrameworkParam: string;

			applicationManager.canStartApplication = () => true;
			applicationManager.isApplicationInstalled = (appId: string) => Future.fromResult(true);
			applicationManager.startApplication = (appId: string, framework: string) => {
				startApplicationAppIdParam = appId;
				startApplicationFrameworkParam = framework;
				return Future.fromResult();
			};

			applicationManager.tryStartApplication("appId").wait();
			assert.deepEqual(startApplicationAppIdParam, "appId");
			assert.deepEqual(startApplicationFrameworkParam, undefined);

			applicationManager.tryStartApplication("appId2", "framework").wait();
			assert.deepEqual(startApplicationAppIdParam, "appId2");
			assert.deepEqual(startApplicationFrameworkParam, "framework");
		});

		it("does not call startApplication, when application is NOT installed", () => {
			let isStartApplicationCalled = false;
			applicationManager.canStartApplication = () => true;
			applicationManager.isApplicationInstalled = (appId: string) => Future.fromResult(false);
			applicationManager.startApplication = (appId: string, framework: string) => {
				isStartApplicationCalled = true;
				return Future.fromResult();
			};

			applicationManager.tryStartApplication("appId").wait();
			assert.isFalse(isStartApplicationCalled, "startApplication must not be called when app is not installed");
		});

		it("does not call startApplication, when application is installed, but canStartApplication returns false", () => {
			let isStartApplicationCalled = false;
			applicationManager.canStartApplication = () => false;
			applicationManager.isApplicationInstalled = (appId: string) => Future.fromResult(true);
			applicationManager.startApplication = (appId: string, framework: string) => {
				isStartApplicationCalled = true;
				return Future.fromResult();
			};

			applicationManager.tryStartApplication("appId").wait();
			assert.isFalse(isStartApplicationCalled, "startApplication must not be called when canStartApplication returns false.");
		});

		describe("does not throw Error", () => {
			let error = new Error("Throw!");
			let isStartApplicationCalled = false;
			let logger: CommonLoggerStub;

			beforeEach(() => {
				isStartApplicationCalled = false;
				logger = testInjector.resolve("logger");
			});

			let assertDoesNotThrow = (opts?: { shouldStartApplicatinThrow: boolean }) => {
				assert.deepEqual(logger.traceOutput, "");
				applicationManager.startApplication = (appId: string, framework: string) => {
					return (() => {
						if (opts && opts.shouldStartApplicatinThrow) {
							throw error;
						}

						isStartApplicationCalled = true;
					}).future<void>()();
				};

				applicationManager.tryStartApplication("appId").wait();
				assert.isFalse(isStartApplicationCalled, "startApplication must not be called when there's an error.");
				assert.isTrue(logger.traceOutput.indexOf("Throw!") !== -1, "Error message must be shown in trace output.");
				assert.isTrue(logger.traceOutput.indexOf("Unable to start application") !== -1, "'Unable to start application' must be shown in trace output.");
			};

			it("when isApplicationInstalled throws error", () => {
				applicationManager.canStartApplication = () => true;
				applicationManager.isApplicationInstalled = (appId: string) => {
					return (() => {
						throw error;
					}).future<boolean>()();
				};

				assertDoesNotThrow();
			});

			it("when canStartApplication throws error", () => {
				applicationManager.canStartApplication = (): boolean => {
					throw error;
				};
				applicationManager.isApplicationInstalled = (appId: string) => Future.fromResult(true);
				assertDoesNotThrow();
			});

			it("when startApplications throws", () => {
				applicationManager.canStartApplication = () => true;
				applicationManager.isApplicationInstalled = (appId: string) => Future.fromResult(true);
				assertDoesNotThrow({shouldStartApplicatinThrow: true});
			});
		});

	});

	describe("reinstallApplication", () => {
		it("calls uninstallApplication with correct arguments", () => {
			let uninstallApplicationAppIdParam: string;
			applicationManager.uninstallApplication = (appId: string) => {
				uninstallApplicationAppIdParam = appId;
				return Future.fromResult();
			};

			applicationManager.reinstallApplication("appId", "packageFilePath").wait();
			assert.deepEqual(uninstallApplicationAppIdParam, "appId");
		});

		it("calls installApplication with correct arguments", () => {
			let installApplicationPackageFilePathParam: string;
			applicationManager.installApplication = (packageFilePath: string) => {
				installApplicationPackageFilePathParam = packageFilePath;
				return Future.fromResult();
			};

			applicationManager.reinstallApplication("appId", "packageFilePath").wait();
			assert.deepEqual(installApplicationPackageFilePathParam, "packageFilePath");
		});

		it("calls uninstallApplication and installApplication in correct order", () => {
			let isInstallApplicationCalled = false,
				isUninstallApplicationCalled = false;

			applicationManager.uninstallApplication = (appId: string) => {
				assert.isFalse(isInstallApplicationCalled, "When uninstallApplication is called, installApplication should not have been called.");
				isUninstallApplicationCalled = true;
				return Future.fromResult();
			};

			applicationManager.installApplication = (packageFilePath: string) => {
				assert.isTrue(isUninstallApplicationCalled, "When installApplication is called, uninstallApplication should have been called.");
				isInstallApplicationCalled = true;
				return Future.fromResult();
			};

			applicationManager.reinstallApplication("appId", "packageFilePath").wait();

			assert.isTrue(isUninstallApplicationCalled, "uninstallApplication should have been called.");
			assert.isTrue(isInstallApplicationCalled, "installApplication should have been called.");
		});
	});
});
