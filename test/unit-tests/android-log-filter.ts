import { AndroidLogFilter } from "../../mobile/android/android-log-filter";
import { LoggingLevels } from "../../mobile/logging-levels";
import { Yok } from "../../yok";
import * as assert from "assert";

let androidApiLevel23TestData = [
	{ input: '12-28 10:14:15.977    99    99 D Genymotion: Received Set Clipboard', output: null },
	{ input: '12-28 10:14:31.303   779   790 I ActivityManager: START u0 {act=android.intent.action.MAIN cat=[android.intent.category.LAUNCHER] flg=0x10200000 cmp=com.telerik.app1/.TelerikCallbackActivity (has extras)} from uid 10008 on display 0', output: null },
	{ input: '--------- beginning of main', output: null },
	{ input: '12-28 10:14:31.314  3593  3593 I art     : Late-enabling -Xcheck:jni', output: null },
	{ input: '12-28 10:14:31.348  3593  3593 W System  : ClassLoader referenced unknown path: /data/app/com.telerik.app1-1/lib/x86', output: null },
	{ input: '12-28 10:14:31.450  3593  3593 V WebViewChromiumFactoryProvider: Binding Chromium to main looper Looper (main, tid 1) {bfa9d51}', output: null },
	{
		input: '12-28 10:14:31.450  3593  3593 I chromium: [INFO:library_loader_hooks.cc(108)] Chromium logging enabled: level = 0, default verbosity = 0',
		output: 'chromium: [INFO:library_loader_hooks.cc(108)] Chromium logging enabled: level = 0, default verbosity = 0'
	},
	{
		input: '12-28 10:14:31.460  3593  3593 I BrowserStartupController: Initializing chromium process, singleProcess=true',
		output: '12-28 10:14:31.460  3593  3593 I BrowserStartupController: Initializing chromium process, singleProcess=true'
	},
	{ input: '12-28 10:14:31.486  3593  3613 W AudioManagerAndroid: Requires BLUETOOTH permission', output: null },
	{ input: '12-28 10:14:31.544  3593  3593 D libEGL  : loaded /system/lib/egl/libEGL_emulation.so', output: null },
	{ input: '12-28 10:14:31.555  3593  3593 D         : HostConnection::get() New Host Connection established 0xe99b30f0, tid 3593', output: null },
	{ input: '12-28 10:14:31.631  3593  3593 D CordovaWebView: CordovaWebView is running on device made by: Genymotion', output: null },
	{
		input: '12-28 10:16:26.239  3659  3659 I chromium: [INFO:CONSOLE(1)] "Uncaught ReferenceError: start is not defined", source: file:///data/user/0/com.telerik.app1/files/12590FAA-5EDD-4B12-856D-F52A0A1599F2/index.html (1)',
		output: 'chromium: [INFO:CONSOLE(1)] "Uncaught ReferenceError: start is not defined", source: file:///data/user/0/com.telerik.app1/files/12590FAA-5EDD-4B12-856D-F52A0A1599F2/index.html (1)'
	},
	{ input: '12-28 10:16:49.267   779  1172 I ActivityManager: Start proc 3714:org.nativescript.appDebug1/u0a60 for activity org.nativescript.appDebug1/com.tns.NativeScriptActivity', output: null },
	{ input: '12-28 10:16:49.316  3714  3714 I TNS.Native: NativeScript Runtime Version 1.5.1, commit c27e977f059e37b3f8230722a4687e16acf43a7f', output: null },
	{ input: '12-28 10:16:49.710  3714  3714 V JS      : TAPPED: 42', output: 'JS: TAPPED: 42' },
	{ input: '12-28 10:16:49.775  3714  3714 D NativeScriptActivity: NativeScriptActivity.onCreate called', output: null },
	{
		input: '12-28 10:16:49.795  3714  3714 I Web Console: Received Event: deviceready at file:///storage/emulated/0/Icenium/com.telerik.TestApp/js/index.js:48',
		output: 'Web Console: Received Event: deviceready at file:///storage/emulated/0/Icenium/com.telerik.TestApp/js/index.js:48'
	}
];

let androidApiLevel22TestData = [
	{ input: '--------- beginning of system', output: null },
	{ input: 'D/Genymotion(   82): Received Ping', output: null },
	{ input: '--------- beginning of main', output: null },
	{ input: 'W/AudioTrack( 1804): AUDIO_OUTPUT_FLAG_FAST denied by client', output: null },
	{ input: 'I/ActivityManager( 1804): START u0 {act=android.intent.action.MAIN cat=[android.intent.category.LAUNCHER] flg=0x10200000 cmp=com.telerik.hybridApp/.TelerikCallbackActivity (has extras)} from uid 10039 on display 0', output: null },
	{ input: 'I/ActivityManager( 1804): Start proc 2971:com.telerik.hybridApp/u0a60 for activity com.telerik.hybridApp/.TelerikCallbackActivity', output: null },
	{ input: 'I/art     ( 2971): Late-enabling -Xcheck:jni', output: null },
	{ input: 'D/        ( 1789): HostConnection::get() New Host Connection established 0xb68c9390, tid 2626', output: null },
	{ input: 'I/CordovaLog( 2971): Changing log level to DEBUG(3)', output: null },
	{ input: 'D/CordovaActivity( 2971): CordovaActivity.init()', output: null },
	{ input: 'I/WebViewFactory( 2971): Loading com.android.webview version 39 (eng.buildbot-x86) (code 399997)', output: null },
	{ input: 'I/LibraryLoader( 2971): Time to load native libraries: 24 ms (timestamps 2169-2193)', output: null },
	{ input: 'I/LibraryLoader( 2971): Expected native library version number "",actual native library version number ""', output: null },
	{ input: 'V/WebViewChromiumFactoryProvider( 2971): Binding Chromium to main looper Looper (main, tid 1) {18cd5cc2}', output: null },
	{ input: 'I/LibraryLoader( 2971): Expected native library version number "",actual native library version number ""', output: null },
	{
		input: 'I/chromium( 2971): [INFO:library_loader_hooks.cc(104)] Chromium logging enabled: level = 0, default verbosity = 0',
		output: 'chromium: [INFO:library_loader_hooks.cc(104)] Chromium logging enabled: level = 0, default verbosity = 0'
	},
	{
		input: 'I/BrowserStartupController( 2971): Initializing chromium process, singleProcess=true',
		output: 'I/BrowserStartupController( 2971): Initializing chromium process, singleProcess=true'
	},
	{ input: 'W/art     ( 2971): Attempt to remove local handle scope entry from IRT, ignoring', output: null },
	{ input: 'W/AudioManagerAndroid( 2971): Requires BLUETOOTH permission', output: null },
	{
		input: 'W/chromium( 2971): [WARNING:resource_bundle.cc(304)] locale_file_path.empty()',
		output: 'chromium: [WARNING:resource_bundle.cc(304)] locale_file_path.empty()'
	},
	{
		input: 'I/chromium( 2971): [INFO:aw_browser_main_parts.cc(65)] Load from apk succesful, fd=30 off=46184 len=3037',
		output: 'chromium: [INFO:aw_browser_main_parts.cc(65)] Load from apk succesful, fd=30 off=46184 len=3037'
	},
	{
		input: 'I/chromium( 2971): [INFO:aw_browser_main_parts.cc(78)] Loading webviewchromium.pak from, fd:31 off:229484 len:1089587',
		output: 'chromium: [INFO:aw_browser_main_parts.cc(78)] Loading webviewchromium.pak from, fd:31 off:229484 len:1089587'
	},
	{ input: 'D/CordovaWebView( 2971): CordovaWebView is running on device made by: Genymotion', output: null },
	{ input: 'D/CordovaWebViewClient( 2971): onPageStarted(file:///android_asset/www/index.html)', output: null },
	{ input: 'D/CordovaActivity( 2971): onMessage(onPageStarted,file:///android_asset/www/index.html)', output: null },
	{ input: 'D/CordovaWebView( 2971): >>> loadUrl(file:///data/data/com.telerik.hybridApp/files/12590FAA-5EDD-4B12-856D-F52A0A1599F2/index.html)', output: null },
	{
		input: 'I/chromium( 2971): [INFO:CONSOLE(1)] "Uncaught ReferenceError: start is not defined", source: file:///data/data/com.telerik.hybridApp/files/12590FAA-5EDD-4B12-856D-F52A0A1599F2/index.html (1)',
		output: 'chromium: [INFO:CONSOLE(1)] "Uncaught ReferenceError: start is not defined", source: file:///data/data/com.telerik.hybridApp/files/12590FAA-5EDD-4B12-856D-F52A0A1599F2/index.html (1)'
	},
	{ input: 'D/CordovaWebView( 2971): The current URL is: file:///data/data/com.telerik.hybridApp/files/12590FAA-5EDD-4B12-856D-F52A0A1599F2/index.html', output: null },
	{ input: 'E/EGL_emulation( 1789): tid 1789: eglCreateSyncKHR(1209): error 0x3004 (EGL_BAD_ATTRIBUTE)', output: null },
	{ input: 'V/JS      ( 3930): TAPPED: 42', output: 'JS: TAPPED: 42' },
	{
		input: 'I/Web Console(    4438): Received Event: deviceready at file:///storage/emulated/0/Icenium/com.telerik.TestApp/js/index.js:48',
		output: 'Web Console: Received Event: deviceready at file:///storage/emulated/0/Icenium/com.telerik.TestApp/js/index.js:48'
	},
	{
		input: `W/System.err( 2507): java.lang.RuntimeException: Unable to create application com.tns.NativeScriptApplication: com.tns.NativeScriptException: Failed to find module: "gosho", relative to: /app/tns_modules/
W/System.err( 2507):    at android.app.ActivityThread.handleBindApplication(ActivityThread.java:4556)
W/System.err( 2507):    at android.app.ActivityThread.access$1500(ActivityThread.java:151)
W/System.err( 2507):    at android.app.ActivityThread$H.handleMessage(ActivityThread.java:1364)
W/System.err( 2507):    at android.os.Handler.dispatchMessage(Handler.java:102)
W/System.err( 2507):    at android.os.Looper.loop(Looper.java:135)
W/System.err( 2507):    at android.app.ActivityThread.main(ActivityThread.java:5254)
W/System.err( 2507):    at java.lang.reflect.Method.invoke(Native Method)
W/System.err( 2507):    at java.lang.reflect.Method.invoke(Method.java:372)
W/System.err( 2507):    at com.android.internal.os.ZygoteInit$MethodAndArgsCaller.run(ZygoteInit.java:903)
W/System.err( 2507):    at com.android.internal.os.ZygoteInit.main(ZygoteInit.java:698)
W/System.err( 2507): Caused by: com.tns.NativeScriptException: Failed to find module: "gosho", relative to: /app/tns_modules/
W/System.err( 2507):    at com.tns.Module.resolvePathHelper(Module.java:220)
W/System.err( 2507):    at com.tns.Module.resolvePath(Module.java:60)
W/System.err( 2507):    at com.tns.Runtime.runModule(Native Method)
W/System.err( 2507):    at com.tns.Runtime.runModule(Runtime.java:241)
W/System.err( 2507):    at com.tns.Runtime.run(Runtime.java:235)
W/System.err( 2507):    at com.tns.NativeScriptApplication.onCreate(NativeScriptApplication.java:17)
W/System.err( 2507):    at android.app.Instrumentation.callApplicationOnCreate(Instrumentation.java:1012)
W/System.err( 2507):    at android.app.ActivityThread.handleBindApplication(ActivityThread.java:4553)
W/System.err( 2507):    ... 9 more`,
		output: `W/System.err( 2507): java.lang.RuntimeException: Unable to create application com.tns.NativeScriptApplication: com.tns.NativeScriptException: Failed to find module: "gosho", relative to: /app/tns_modules/
W/System.err( 2507):    at android.app.ActivityThread.handleBindApplication(ActivityThread.java:4556)
W/System.err( 2507):    at android.app.ActivityThread.access$1500(ActivityThread.java:151)
W/System.err( 2507):    at android.app.ActivityThread$H.handleMessage(ActivityThread.java:1364)
W/System.err( 2507):    at android.os.Handler.dispatchMessage(Handler.java:102)
W/System.err( 2507):    at android.os.Looper.loop(Looper.java:135)
W/System.err( 2507):    at android.app.ActivityThread.main(ActivityThread.java:5254)
W/System.err( 2507):    at java.lang.reflect.Method.invoke(Native Method)
W/System.err( 2507):    at java.lang.reflect.Method.invoke(Method.java:372)
W/System.err( 2507):    at com.android.internal.os.ZygoteInit$MethodAndArgsCaller.run(ZygoteInit.java:903)
W/System.err( 2507):    at com.android.internal.os.ZygoteInit.main(ZygoteInit.java:698)
W/System.err( 2507): Caused by: com.tns.NativeScriptException: Failed to find module: "gosho", relative to: /app/tns_modules/
W/System.err( 2507):    at com.tns.Module.resolvePathHelper(Module.java:220)
W/System.err( 2507):    at com.tns.Module.resolvePath(Module.java:60)
W/System.err( 2507):    at com.tns.Runtime.runModule(Native Method)
W/System.err( 2507):    at com.tns.Runtime.runModule(Runtime.java:241)
W/System.err( 2507):    at com.tns.Runtime.run(Runtime.java:235)
W/System.err( 2507):    at com.tns.NativeScriptApplication.onCreate(NativeScriptApplication.java:17)
W/System.err( 2507):    at android.app.Instrumentation.callApplicationOnCreate(Instrumentation.java:1012)
W/System.err( 2507):    at android.app.ActivityThread.handleBindApplication(ActivityThread.java:4553)
W/System.err( 2507):    ... 9 more`
	},
	{
		input: `W/System.err( 2507): Caused by: com.tns.NativeScriptException: Failed to find module: "gosho", relative to: /app/tns_modules/
W/System.err( 2507):    at com.tns.Module.resolvePathHelper(Module.java:220)
W/System.err( 2507):    at com.tns.Module.resolvePath(Module.java:60)
W/System.err( 2507):    at com.tns.Runtime.runModule(Native Method)
W/System.err( 2507):    at com.tns.Runtime.runModule(Runtime.java:241)
W/System.err( 2507):    at com.tns.Runtime.run(Runtime.java:235)
W/System.err( 2507):    at com.tns.NativeScriptApplication.onCreate(NativeScriptApplication.java:17)
W/System.err( 2507):    at android.app.Instrumentation.callApplicationOnCreate(Instrumentation.java:1012)
W/System.err( 2507):    at android.app.ActivityThread.handleBindApplication(ActivityThread.java:4553)
W/System.err( 2507):    ... 9 more`,
		output: `W/System.err( 2507): Caused by: com.tns.NativeScriptException: Failed to find module: "gosho", relative to: /app/tns_modules/
W/System.err( 2507):    at com.tns.Module.resolvePathHelper(Module.java:220)
W/System.err( 2507):    at com.tns.Module.resolvePath(Module.java:60)
W/System.err( 2507):    at com.tns.Runtime.runModule(Native Method)
W/System.err( 2507):    at com.tns.Runtime.runModule(Runtime.java:241)
W/System.err( 2507):    at com.tns.Runtime.run(Runtime.java:235)
W/System.err( 2507):    at com.tns.NativeScriptApplication.onCreate(NativeScriptApplication.java:17)
W/System.err( 2507):    at android.app.Instrumentation.callApplicationOnCreate(Instrumentation.java:1012)
W/System.err( 2507):    at android.app.ActivityThread.handleBindApplication(ActivityThread.java:4553)
W/System.err( 2507):    ... 9 more`
	}
];

describe("androidLogFilter", () => {

	let assertFiltering = (inputData: string, expectedOutput: string, logLevel?: string) => {
		let testInjector = new Yok();
		testInjector.register("loggingLevels", LoggingLevels);
		let androidLogFilter = testInjector.resolve(AndroidLogFilter);
		let filteredData = androidLogFilter.filterData(inputData, logLevel);
		assert.deepEqual(filteredData, expectedOutput, `The actual result '${filteredData}' did NOT match expected output '${expectedOutput}'.`);
	};

	let logLevel = "INFO";

	describe("filterData", () => {
		describe("when log level is full", () => {
			let counter = 0;
			beforeEach(() => logLevel = "FULL");
			_.each(androidApiLevel23TestData, testData => {
				it("when API level 23 or later is used" + (counter++), () => {
					assertFiltering(testData.input, testData.input, logLevel);
				});
			});

			counter = 0;

			_.each(androidApiLevel22TestData, testData => {
				it("when API level 22 is used" + (counter++), () => {
					assertFiltering(testData.input, testData.input, logLevel);
				});
			});
		});

		describe("when log level is info", () => {
			beforeEach(() => logLevel = "info");
			let counter = 0;
			_.each(androidApiLevel23TestData, testData => {
				it("when API level 23 or later is used " + (counter++), () => {
					assertFiltering(testData.input, testData.output, logLevel);
				});
			});

			counter = 0;

			_.each(androidApiLevel22TestData, testData => {
				it("when API level 22 is used " + (counter++), () => {
					assertFiltering(testData.input, testData.output, logLevel);
				});
			});
		});

		describe("when log level is not specified", () => {
			beforeEach(() => logLevel = "");
			let counter = 0;
			_.each(androidApiLevel22TestData, testData => {
				it("when API level 23 or later is used " + (counter++), () => {
					assertFiltering(testData.input, testData.input, null);
				});
			});

			counter = 0;
			_.each(androidApiLevel22TestData, testData => {
				it("when API level 22 is used " + (counter++), () => {
					assertFiltering(testData.input, testData.input, null);
				});
			});
		});
	});
});
