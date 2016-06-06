import { IOSLogFilter } from "../../mobile/ios/ios-log-filter";
import { LoggingLevels } from "../../mobile/logging-levels";
import { Yok } from "../../yok";
import * as assert from "assert";

let iosTestData = [
	{ input: 'Dec 29 08:46:04 Dragons-iPhone iaptransportd[65] <Warning>: CIapPortAppleIDBus: Auth timer timeout completed on pAIDBPort:0x135d09410, portID:01 downstream port', output: null },
	{ input: 'Dec 29 08:46:06 Dragons-iPhone kernel[0] <Notice>: AppleARMPMUCharger: AppleUSBCableDetect 1', output: null },
	{ input: 'Dec 29 08:47:24 Dragons-iPhone bird[131] <Error>: unable to determine evictable space: Error Domain=LibrarianErrorDomain Code=10 "The operation couldn’t be completed. (LibrarianErrorDomain error 10 - Unable to configure the collection.)" UserInfo=0x137528190 {NSDescription=Unable to configure the collection.}', output: null },
	{ input: 'Dec 29 08:47:43 Dragons-iPhone syslog_relay[179] <Notice>: syslog_relay found the ASL prompt. Starting...', output: null },
	{ input: 'Dec 29 08:48:47 Dragons-iPhone com.apple.xpc.launchd[1] (com.apple.WebKit.Networking.08B3A589-3D68-492A-BA8D-A812EC55FDEB[13306]) <Warning>: Service exited with abnormal code: 1', output: null },
	{ input: 'Dec 29 08:48:47 Dragons-iPhone ReportCrash[13308] <Notice>: Saved report to /var/mobile/Library/Logs/CrashReporter/Cordova370_2015-12-29-084847_Dragons-iPhone.ips', output: null },
	{ input: 'Dec 29 08:48:47 Dragons-iPhone com.apple.WebKit.Networking[13306] <Error>: Failed to obtain sandbox extension for path=/private/var/mobile/Containers/Data/Application/047BB8F2-B8C8-405F-A820-8719EE207E6F/Library/Caches/com.telerik.BlankJS. Errno:1', output: null },
	{ input: 'Dec 29 08:49:06 Dragons-iPhone Cordova370[13309] <Warning>: Apache Cordova native platform version 3.7.0 is starting.',
		output: '<Warning>: Apache Cordova native platform version 3.7.0 is starting.' },
	{ input: 'Dec 29 08:49:06 Dragons-iPhone Cordova370[13309] <Notice>: Multi-tasking -> Device: YES, App: YES', output: null },
	{ input: 'Dec 29 08:49:06 Dragons-iPhone Cordova370[13309] <Warning>: Unlimited access to network resources',
		output: '<Warning>: Unlimited access to network resources' },
	{ input: 'Dec 29 08:49:06 Dragons-iPhone Cordova370[13309] <Warning>: Finished load of: file:///var/mobile/Containers/Data/Application/0746156D-3C83-402E-8B4E-2B3063F42F76/Documents/index.html',
		output: '<Warning>: Finished load of: file:///var/mobile/Containers/Data/Application/0746156D-3C83-402E-8B4E-2B3063F42F76/Documents/index.html' },
	{ input: 'Dec 29 08:49:06 Dragons-iPhone Cordova370[13309] <Warning>: ---------------------------------- LOG FROM MY APP',
		output: '<Warning>: ---------------------------------- LOG FROM MY APP' },
	{ input: 'Dec 29 08:50:31 Dragons-iPhone NativeScript143[13314] <Error>: assertion failed: 12F70: libxpc.dylib + 71768 [B870B51D-AA85-3686-A7D9-ACD48C5FE153]: 0x7d',
		output: '<Error>: assertion failed: 12F70: libxpc.dylib + 71768 [B870B51D-AA85-3686-A7D9-ACD48C5FE153]: 0x7d' },
	{ input: 'Dec 29 08:50:31 Dragons-iPhone Unknown[13314] <Error>:', output: null },
	{ input: 'Dec 29 08:50:31 Dragons-iPhone locationd[57] <Notice>: Gesture EnabledForTopCLient: 0, EnabledInDaemonSettings: 0', output: null },
	{ input: 'Dec 29 08:55:24 Dragons-iPhone NativeScript143[13323] <Notice>: file:///app/main-view-model.js:11:14: CONSOLE LOG COUNTER: 41',
		output: '<Notice>: file:///app/main-view-model.js:11:14: CONSOLE LOG COUNTER: 41'},
	{ input: 'Dec 29 08:55:24 Dragons-iPhone NativeScript143[13323] <Notice>: file:///app/main-view-model.js:11:14: CONSOLE LOG COUNTER: 41\n',
		output: '<Notice>: file:///app/main-view-model.js:11:14: CONSOLE LOG COUNTER: 41'}
];

describe("iOSLogFilter", () => {

	let assertFiltering = (inputData: string, expectedOutput: string, logLevel?: string) => {
		let testInjector = new Yok();
		testInjector.register("loggingLevels", LoggingLevels);
		let androidLogFilter = testInjector.resolve(IOSLogFilter);
		let filteredData = androidLogFilter.filterData(inputData, logLevel);
		assert.deepEqual(filteredData, expectedOutput, `The actual result '${filteredData}' did NOT match expected output '${expectedOutput}'.`);
	};

	let logLevel = "INFO";

	describe("filterData", () => {
		it("when log level is full returns full data", () => {
			logLevel = "FULL";
			_.each(iosTestData, testData => {
				assertFiltering(testData.input, testData.input, logLevel);
			});
		});

		it("when log level is INFO filters data", () => {
			logLevel = "INFO";
			_.each(iosTestData, testData => {
				assertFiltering(testData.input, testData.output, logLevel);
			});
		});

		it("when log level is not specified returns full data", () => {
			logLevel = null;
			_.each(iosTestData, testData => {
				assertFiltering(testData.input, testData.input);
			});
		});
	});
});
