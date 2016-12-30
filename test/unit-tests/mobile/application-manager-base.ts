import { Yok } from "../../../yok";
import { assert } from "chai";
import { CommonLoggerStub, HooksServiceStub } from "../stubs";
import { ApplicationManagerBase } from "../../../mobile/application-manager-base";


let currentlyAvailableAppsForDebugging: Mobile.IDeviceApplicationInformation[],
	currentlyInstalledApps: string[],
	currentlyAvailableAppWebViewsForDebugging: IDictionary<Mobile.IDebugWebViewInfo[]>;

class ApplicationManager extends ApplicationManagerBase {
	constructor($logger: ILogger, $hooksService: IHooksService) {
		super($logger, $hooksService);
	}

	public async isLiveSyncSupported(appIdentifier: string): Promise<boolean> {
		return Promise.resolve(true);
	}

	public async installApplication(packageFilePath: string): Promise<void> {
		return Promise.resolve();
	}

	public async uninstallApplication(appIdentifier: string): Promise<void> {
		return Promise.resolve();
	}

	public async startApplication(appIdentifier: string, framework?: string): Promise<void> {
		return Promise.resolve();
	}

	public async stopApplication(appIdentifier: string): Promise<void> {
		return Promise.resolve();
	}

	public async getInstalledApplications(): Promise<string[]> {
		return Promise.resolve(_.cloneDeep(currentlyInstalledApps));
	}

	public async getApplicationInfo(applicationIdentifier: string): Promise<Mobile.IApplicationInfo> {
		return Promise.resolve(null);
	}

	public canStartApplication(): boolean {
		return true;
	}

	public async getDebuggableApps(): Promise<Mobile.IDeviceApplicationInformation[]> {
		return Promise.resolve(currentlyAvailableAppsForDebugging);
	}

	public async getDebuggableAppViews(appIdentifiers: string[]): Promise<IDictionary<Mobile.IDebugWebViewInfo[]>> {
		return Promise.resolve(_.cloneDeep(currentlyAvailableAppWebViewsForDebugging));
	}
}

function createTestInjector(): IInjector {
	let testInjector = new Yok();
	testInjector.register("logger", CommonLoggerStub);
	testInjector.register("hooksService", HooksServiceStub);
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

function createDebuggableWebView(uniqueId: string) {
	return {
		description: `description_${uniqueId}`,
		devtoolsFrontendUrl: `devtoolsFrontendUrl_${uniqueId}`,
		id: `${uniqueId}`,
		title: `title_${uniqueId}`,
		type: `type_${uniqueId}`,
		url: `url_${uniqueId}`,
		webSocketDebuggerUrl: `webSocketDebuggerUrl_${uniqueId}`,
	};
}

function createDebuggableWebViews(appInfos: Mobile.IDeviceApplicationInformation[], numberOfViews: number): IDictionary<Mobile.IDebugWebViewInfo[]> {
	let result: IDictionary<Mobile.IDebugWebViewInfo[]> = {};
	_.each(appInfos, (appInfo, index) => {
		result[appInfo.appIdentifier] = _.times(numberOfViews, (currentViewIndex: number) => createDebuggableWebView(`${index}_${currentViewIndex}`));
	});

	return result;
}

describe("ApplicationManagerBase", () => {
	let applicationManager: ApplicationManager,
		testInjector: IInjector;

	beforeEach(() => {
		testInjector = createTestInjector();
		currentlyAvailableAppsForDebugging = null;
		currentlyAvailableAppWebViewsForDebugging = null;
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

				await applicationManager.checkForApplicationUpdates();
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

				await applicationManager.checkForApplicationUpdates();
				currentlyAvailableAppsForDebugging = createAppsAvailableForDebugging(2);
				await applicationManager.checkForApplicationUpdates();
				currentlyAvailableAppsForDebugging = createAppsAvailableForDebugging(4);
				isFinalCheck = true;
				await applicationManager.checkForApplicationUpdates();
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
				await applicationManager.checkForApplicationUpdates();
				currentlyAvailableAppsForDebugging = [];
				// This call should raise debuggableAppLost two times.
				await applicationManager.checkForApplicationUpdates();
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

				await applicationManager.checkForApplicationUpdates();
				currentlyAvailableAppsForDebugging = createAppsAvailableForDebugging(2);
				await applicationManager.checkForApplicationUpdates();
				currentlyAvailableAppsForDebugging = createAppsAvailableForDebugging(0);
				isFinalCheck = true;
				await applicationManager.checkForApplicationUpdates();
			});

			it("emits debuggableAppFound and debuggableAppLost when applications are changed", () => {
				let allAppsForDebug = createAppsAvailableForDebugging(4);
				currentlyAvailableAppsForDebugging = _.take(allAppsForDebug, 2);
				let remainingAppsForDebugging = _.difference(allAppsForDebug, currentlyAvailableAppsForDebugging);

				let foundAppsForDebug: Mobile.IDeviceApplicationInformation[] = [],
					futures: Promise<void>[] = [];

				// This will raise debuggableAppFound 2 times.
				await applicationManager.checkForApplicationUpdates();

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
				await applicationManager.checkForApplicationUpdates();
				Future.wait(futures);
			});

			it("emits debuggableViewFound when new views are available for debug", (done) => {
				currentlyAvailableAppsForDebugging = createAppsAvailableForDebugging(2);
				let numberOfViewsPerApp = 2;
				currentlyAvailableAppWebViewsForDebugging = createDebuggableWebViews(currentlyAvailableAppsForDebugging, numberOfViewsPerApp);
				let currentDebuggableViews: IDictionary<Mobile.IDebugWebViewInfo[]> = {};
				applicationManager.on("debuggableViewFound", (appIdentifier: string, d: Mobile.IDebugWebViewInfo) => {
					currentDebuggableViews[appIdentifier] = currentDebuggableViews[appIdentifier] || [];
					currentDebuggableViews[appIdentifier].push(d);
					let numberOfFoundViewsPerApp = _.uniq(_.values(currentDebuggableViews).map(arr => arr.length));
					if (_.keys(currentDebuggableViews).length === currentlyAvailableAppsForDebugging.length
						&& numberOfFoundViewsPerApp.length === 1 // for all apps we've found exactly two apps.
						&& numberOfFoundViewsPerApp[0] === numberOfViewsPerApp) {
						_.each(currentDebuggableViews, (webViews, appId) => {
							_.each(webViews, webView => {
								let expectedWebView = _.find(currentlyAvailableAppWebViewsForDebugging[appId], c => c.id === webView.id);
								assert.isTrue(_.isEqual(webView, expectedWebView));
							});
						});
						setTimeout(done, 0);
					}
				});

				await applicationManager.checkForApplicationUpdates();
			});

			it("emits debuggableViewLost when views for debug are removed", (done) => {
				currentlyAvailableAppsForDebugging = createAppsAvailableForDebugging(2);
				let numberOfViewsPerApp = 2;
				currentlyAvailableAppWebViewsForDebugging = createDebuggableWebViews(currentlyAvailableAppsForDebugging, numberOfViewsPerApp);
				let expectedResults = _.cloneDeep(currentlyAvailableAppWebViewsForDebugging);
				let currentDebuggableViews: IDictionary<Mobile.IDebugWebViewInfo[]> = {};

				await applicationManager.checkForApplicationUpdates();

				applicationManager.on("debuggableViewLost", (appIdentifier: string, d: Mobile.IDebugWebViewInfo) => {
					currentDebuggableViews[appIdentifier] = currentDebuggableViews[appIdentifier] || [];
					currentDebuggableViews[appIdentifier].push(d);
					let numberOfFoundViewsPerApp = _.uniq(_.values(currentDebuggableViews).map(arr => arr.length));
					if (_.keys(currentDebuggableViews).length === currentlyAvailableAppsForDebugging.length
						&& numberOfFoundViewsPerApp.length === 1 // for all apps we've found exactly two apps.
						&& numberOfFoundViewsPerApp[0] === numberOfViewsPerApp) {
						_.each(currentDebuggableViews, (webViews, appId) => {
							_.each(webViews, webView => {
								let expectedWebView = _.find(expectedResults[appId], c => c.id === webView.id);
								assert.isTrue(_.isEqual(webView, expectedWebView));
							});
						});
						setTimeout(done, 0);
					}
				});

				currentlyAvailableAppWebViewsForDebugging = _.mapValues(currentlyAvailableAppWebViewsForDebugging, (a) => []);

				await applicationManager.checkForApplicationUpdates();
			});

			it("emits debuggableViewFound when new views are available for debug", (done) => {
				currentlyAvailableAppsForDebugging = createAppsAvailableForDebugging(2);
				let numberOfViewsPerApp = 2;
				currentlyAvailableAppWebViewsForDebugging = createDebuggableWebViews(currentlyAvailableAppsForDebugging, numberOfViewsPerApp);

				await applicationManager.checkForApplicationUpdates();

				let expectedViewToBeFound = createDebuggableWebView("uniqueId"),
					expectedAppIdentifier = currentlyAvailableAppsForDebugging[0].appIdentifier,
					isLastCheck = false;

				applicationManager.on("debuggableViewFound", (appIdentifier: string, d: Mobile.IDebugWebViewInfo) => {
					assert.deepEqual(appIdentifier, expectedAppIdentifier);
					assert.isTrue(_.isEqual(d, expectedViewToBeFound));

					if (isLastCheck) {
						setTimeout(done, 0);
					}
				});

				currentlyAvailableAppWebViewsForDebugging[expectedAppIdentifier].push(_.cloneDeep(expectedViewToBeFound));
				await applicationManager.checkForApplicationUpdates();

				expectedViewToBeFound = createDebuggableWebView("uniqueId1");
				currentlyAvailableAppWebViewsForDebugging[expectedAppIdentifier].push(_.cloneDeep(expectedViewToBeFound));
				await applicationManager.checkForApplicationUpdates();

				expectedViewToBeFound = createDebuggableWebView("uniqueId2");
				expectedAppIdentifier = currentlyAvailableAppsForDebugging[1].appIdentifier;
				isLastCheck = true;

				currentlyAvailableAppWebViewsForDebugging[expectedAppIdentifier].push(_.cloneDeep(expectedViewToBeFound));
				await applicationManager.checkForApplicationUpdates();
			});

			it("emits debuggableViewLost when views for debug are not available anymore", (done) => {
				currentlyAvailableAppsForDebugging = createAppsAvailableForDebugging(2);
				let numberOfViewsPerApp = 2;
				currentlyAvailableAppWebViewsForDebugging = createDebuggableWebViews(currentlyAvailableAppsForDebugging, numberOfViewsPerApp);

				await applicationManager.checkForApplicationUpdates();

				let expectedAppIdentifier = currentlyAvailableAppsForDebugging[0].appIdentifier,
					expectedViewToBeLost = currentlyAvailableAppWebViewsForDebugging[expectedAppIdentifier].splice(0, 1)[0],
					isLastCheck = false;

				applicationManager.on("debuggableViewLost", (appIdentifier: string, d: Mobile.IDebugWebViewInfo) => {
					assert.deepEqual(appIdentifier, expectedAppIdentifier);
					assert.isTrue(_.isEqual(d, expectedViewToBeLost));

					if (isLastCheck) {
						setTimeout(done, 0);
					}
				});

				await applicationManager.checkForApplicationUpdates();

				expectedViewToBeLost = currentlyAvailableAppWebViewsForDebugging[expectedAppIdentifier].splice(0, 1)[0];
				await applicationManager.checkForApplicationUpdates();

				expectedAppIdentifier = currentlyAvailableAppsForDebugging[1].appIdentifier;
				expectedViewToBeLost = currentlyAvailableAppWebViewsForDebugging[expectedAppIdentifier].splice(0, 1)[0];

				isLastCheck = true;
				await applicationManager.checkForApplicationUpdates();
			});

			it("emits debuggableViewChanged when view's property is modified (each one except id)", (done) => {
				currentlyAvailableAppsForDebugging = createAppsAvailableForDebugging(1);
				currentlyAvailableAppWebViewsForDebugging = createDebuggableWebViews(currentlyAvailableAppsForDebugging, 2);
				let viewToChange = currentlyAvailableAppWebViewsForDebugging[currentlyAvailableAppsForDebugging[0].appIdentifier][0];
				let expectedView = _.cloneDeep(viewToChange);
				expectedView.title = "new title";

				applicationManager.on("debuggableViewChanged", (appIdentifier: string, d: Mobile.IDebugWebViewInfo) => {
					assert.isTrue(_.isEqual(d, expectedView));
					setTimeout(done, 0);
				});

				await applicationManager.checkForApplicationUpdates();
				viewToChange.title = "new title";
				await applicationManager.checkForApplicationUpdates();
			});

			it("does not emit debuggableViewChanged when id is modified", (done) => {
				currentlyAvailableAppsForDebugging = createAppsAvailableForDebugging(1);
				currentlyAvailableAppWebViewsForDebugging = createDebuggableWebViews(currentlyAvailableAppsForDebugging, 2);
				let viewToChange = currentlyAvailableAppWebViewsForDebugging[currentlyAvailableAppsForDebugging[0].appIdentifier][0];
				let expectedView = _.cloneDeep(viewToChange);

				await applicationManager.checkForApplicationUpdates();
				applicationManager.on("debuggableViewChanged", (appIdentifier: string, d: Mobile.IDebugWebViewInfo) => {
					setTimeout(() => done(new Error("When id is changed, debuggableViewChanged must not be emitted.")), 0);
				});

				applicationManager.on("debuggableViewLost", (appIdentifier: string, d: Mobile.IDebugWebViewInfo) => {
					assert.isTrue(_.isEqual(d, expectedView));
				});

				applicationManager.on("debuggableViewFound", (appIdentifier: string, d: Mobile.IDebugWebViewInfo) => {
					expectedView.id = "new id";
					assert.isTrue(_.isEqual(d, expectedView));
					setTimeout(done, 0);
				});

				viewToChange.id = "new id";
				await applicationManager.checkForApplicationUpdates();
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

				await applicationManager.checkForApplicationUpdates();
				await future;

				_.each(currentlyInstalledApps, (c: string, index: number) => {
					assert.deepEqual(c, reportedInstalledApps[index]);
				});

				assert.deepEqual(reportedInstalledApps.length, currentlyInstalledApps.length);
			});

			it("reports installed applications when apps are changed between executions", () => {
				currentlyInstalledApps = ["app1", "app2", "app3"];

				let reportedInstalledApps: string[] = [],
					future: Promise<void>;

				applicationManager.on("applicationInstalled", (app: string) => {
					reportedInstalledApps.push(app);
					if (reportedInstalledApps.length === currentlyInstalledApps.length) {
						future.return();
					}
				});

				let testInstalledAppsResults = () => {
					future = new Future<void>();
					await applicationManager.checkForApplicationUpdates();
					await future;

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
				await applicationManager.checkForApplicationUpdates();
				currentlyInstalledApps = [];

				applicationManager.on("applicationUninstalled", (app: string) => {
					reportedUninstalledApps.push(app);
					if (reportedUninstalledApps.length === initiallyInstalledApps.length) {
						future.return();
					}
				});

				await applicationManager.checkForApplicationUpdates();
				await future;

				_.each(initiallyInstalledApps, (c: string, index: number) => {
					assert.deepEqual(c, reportedUninstalledApps[index]);
				});

				assert.deepEqual(reportedUninstalledApps.length, initiallyInstalledApps.length);
			});

			it("reports uninstalled applications when apps are changed between executions", () => {
				currentlyInstalledApps = ["app1", "app2", "app3", "app4", "app5", "app6"];

				let reportedUninstalledApps: string[] = [],
					removedApps: string[] = [],
					future: Promise<void>;

				// Initialize - all apps are marked as installed.
				await applicationManager.checkForApplicationUpdates();
				applicationManager.on("applicationUninstalled", (app: string) => {
					reportedUninstalledApps.push(app);
					if (reportedUninstalledApps.length === removedApps.length) {
						future.return();
					}
				});

				let testInstalledAppsResults = () => {
					future = new Future<void>();
					await applicationManager.checkForApplicationUpdates();
					await future;

					_.each(removedApps, (c: string, index: number) => {
						assert.deepEqual(c, reportedUninstalledApps[index]);
					});

					assert.deepEqual(reportedUninstalledApps.length, removedApps.length);
				};

				while (currentlyInstalledApps.length) {
					let currentlyRemovedApps = currentlyInstalledApps.splice(0, 2);
					removedApps = removedApps.concat(currentlyRemovedApps);
					testInstalledAppsResults();
				}
			});

			it("reports installed and uninstalled apps when apps are changed between executions", () => {
				currentlyInstalledApps = ["app1", "app2", "app3", "app4", "app5", "app6"];

				let reportedUninstalledApps: string[] = [],
					reportedInstalledApps: string[] = [],
					installedApps: string[] = [],
					removedApps: string[] = [],
					appUninstalledFuture: Promise<void>,
					appInstalledFuture: Promise<void>,
					waitForAppInstalledFuture = true;

				// Initialize - all apps are marked as installed.
				await applicationManager.checkForApplicationUpdates();
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
					await applicationManager.checkForApplicationUpdates();

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
					removedApps = removedApps.concat(currentlyRemovedApps);

					let currentlyAddedApps = [`app${index}`];
					currentlyInstalledApps = currentlyInstalledApps.concat(currentlyAddedApps);
					installedApps = installedApps.concat(currentlyAddedApps);

					testInstalledAppsResults();
				}
			});
		});
	});

	describe("isApplicationInstalled", () => {
		it("returns true when app is installed", () => {
			currentlyInstalledApps = ["app1", "app2"];
			await assert.isTrue(applicationManager.isApplicationInstalled("app1"), "app1 is installed, so result of isAppInstalled must be true.");
			await assert.isTrue(applicationManager.isApplicationInstalled("app2"), "app2 is installed, so result of isAppInstalled must be true.");
		});

		it("returns false when app is NOT installed", () => {
			currentlyInstalledApps = ["app1", "app2"];
			await assert.isFalse(applicationManager.isApplicationInstalled("app3"), "app3 is NOT installed, so result of isAppInstalled must be false.");
			await assert.isFalse(applicationManager.isApplicationInstalled("app4"), "app4 is NOT installed, so result of isAppInstalled must be false.");
		});
	});

	describe("restartApplication", () => {
		it("calls stopApplication with correct arguments", () => {
			let stopApplicationParam: string;
			applicationManager.stopApplication = (appId: string) => {
				stopApplicationParam = appId;
				return Promise.resolve();
			};

			await applicationManager.restartApplication("appId");
			assert.deepEqual(stopApplicationParam, "appId", "When bundleIdentifier is not passed to restartApplication, stopApplication must be called with application identifier.");

			await applicationManager.restartApplication("appId", "bundleIdentifier");
			assert.deepEqual(stopApplicationParam, "bundleIdentifier", "When bundleIdentifier is passed to restartApplication, stopApplication must be called with bundleIdentifier.");
		});

		it("calls startApplication with correct arguments", () => {
			let startApplicationAppIdParam: string,
				startApplicationFrameworkParam: string;
			applicationManager.startApplication = (appId: string, framework: string) => {
				startApplicationAppIdParam = appId;
				startApplicationFrameworkParam = framework;
				return Promise.resolve();
			};

			await applicationManager.restartApplication("appId");
			assert.deepEqual(startApplicationAppIdParam, "appId", "startApplication must be called with application identifier.");
			assert.deepEqual(startApplicationFrameworkParam, undefined, "When framework is not passed to restartApplication, startApplication must be called with undefined framework.");

			await applicationManager.restartApplication("appId", null, "cordova");
			assert.deepEqual(startApplicationAppIdParam, "appId", "startApplication must be called with application identifier.");
			assert.deepEqual(startApplicationFrameworkParam, "cordova", "When framework is passed to restartApplication, startApplication must be called with this framework.");
		});

		it("calls stopApplication and startApplication in correct order", () => {
			let isStartApplicationCalled = false,
				isStopApplicationCalled = false;

			applicationManager.stopApplication = (appId: string) => {
				isStopApplicationCalled = true;
				return Promise.resolve();
			};

			applicationManager.startApplication = (appId: string, framework: string) => {
				assert.isTrue(isStopApplicationCalled, "When startApplication is called, stopApplication must have been resolved.");
				isStartApplicationCalled = true;
				return Promise.resolve();
			};

			await applicationManager.restartApplication("appId");
			assert.isTrue(isStopApplicationCalled, "stopApplication must be called.");
			assert.isTrue(isStartApplicationCalled, "startApplication must be called.");
		});
	});

	describe("tryStartApplication", () => {
		it("calls startApplication, when canStartApplication returns true", () => {
			let startApplicationAppIdParam: string,
				startApplicationFrameworkParam: string;

			applicationManager.canStartApplication = () => true;
			applicationManager.startApplication = (appId: string, framework: string) => {
				startApplicationAppIdParam = appId;
				startApplicationFrameworkParam = framework;
				return Promise.resolve();
			};

			await applicationManager.tryStartApplication("appId");
			assert.deepEqual(startApplicationAppIdParam, "appId");
			assert.deepEqual(startApplicationFrameworkParam, undefined);

			await applicationManager.tryStartApplication("appId2", "framework");
			assert.deepEqual(startApplicationAppIdParam, "appId2");
			assert.deepEqual(startApplicationFrameworkParam, "framework");
		});

		it("does not call startApplication, when canStartApplication returns false", () => {
			let isStartApplicationCalled = false;
			applicationManager.canStartApplication = () => false;
			applicationManager.startApplication = (appId: string, framework: string) => {
				isStartApplicationCalled = true;
				return Promise.resolve();
			};

			await applicationManager.tryStartApplication("appId");
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

				await applicationManager.tryStartApplication("appId");
				assert.isFalse(isStartApplicationCalled, "startApplication must not be called when there's an error.");
				assert.isTrue(logger.traceOutput.indexOf("Throw!") !== -1, "Error message must be shown in trace output.");
				assert.isTrue(logger.traceOutput.indexOf("Unable to start application") !== -1, "'Unable to start application' must be shown in trace output.");
			};

			it("when canStartApplication throws error", () => {
				applicationManager.canStartApplication = (): boolean => {
					throw error;
				};
				applicationManager.isApplicationInstalled = (appId: string) => Promise.resolve(true);
				assertDoesNotThrow();
			});

			it("when startApplications throws", () => {
				applicationManager.canStartApplication = () => true;
				applicationManager.isApplicationInstalled = (appId: string) => Promise.resolve(true);
				assertDoesNotThrow({ shouldStartApplicatinThrow: true });
			});
		});

	});

	describe("reinstallApplication", () => {
		it("calls uninstallApplication with correct arguments", () => {
			let uninstallApplicationAppIdParam: string;
			applicationManager.uninstallApplication = (appId: string) => {
				uninstallApplicationAppIdParam = appId;
				return Promise.resolve();
			};

			await applicationManager.reinstallApplication("appId", "packageFilePath");
			assert.deepEqual(uninstallApplicationAppIdParam, "appId");
		});

		it("calls installApplication with correct arguments", () => {
			let installApplicationPackageFilePathParam: string;
			applicationManager.installApplication = (packageFilePath: string) => {
				installApplicationPackageFilePathParam = packageFilePath;
				return Promise.resolve();
			};

			await applicationManager.reinstallApplication("appId", "packageFilePath");
			assert.deepEqual(installApplicationPackageFilePathParam, "packageFilePath");
		});

		it("calls uninstallApplication and installApplication in correct order", () => {
			let isInstallApplicationCalled = false,
				isUninstallApplicationCalled = false;

			applicationManager.uninstallApplication = (appId: string) => {
				assert.isFalse(isInstallApplicationCalled, "When uninstallApplication is called, installApplication should not have been called.");
				isUninstallApplicationCalled = true;
				return Promise.resolve();
			};

			applicationManager.installApplication = (packageFilePath: string) => {
				assert.isTrue(isUninstallApplicationCalled, "When installApplication is called, uninstallApplication should have been called.");
				isInstallApplicationCalled = true;
				return Promise.resolve();
			};

			await applicationManager.reinstallApplication("appId", "packageFilePath");

			assert.isTrue(isUninstallApplicationCalled, "uninstallApplication should have been called.");
			assert.isTrue(isInstallApplicationCalled, "installApplication should have been called.");
		});
	});
});
