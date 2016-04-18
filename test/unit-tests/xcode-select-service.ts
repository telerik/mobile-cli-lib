///<reference path="../.d.ts"/>
"use strict";

import {Yok} from "../../yok";
import {XcodeSelectService} from "../../services/xcode-select-service";
import {assert} from "chai";
import * as path from "path";
import Future = require("fibers/future");

let executionStopped = false;

function createTestInjector(config: { xcodeSelectStdout: string, isDarwin: boolean, xcodeVersionOutput?: string }): IInjector {
	let testInjector = new Yok();
	testInjector.register("childProcess", {
		spawnFromEvent: (command: string, args: string[], event: string): IFuture<any> => Future.fromResult({
			stdout: config.xcodeSelectStdout
		})
	});
	testInjector.register("sysInfo", {
		getSysInfo: (pathToPackageJson: string, androidToolsInfo?: { pathToAdb: string, pathToAndroid: string }) => {
			return Future.fromResult({
				xcodeVer: config.xcodeVersionOutput
			});
		}
	});
	testInjector.register("errors", {
		failWithoutHelp: (message: string, ...args: any[]): void => { executionStopped=true; }
	});

	testInjector.register("hostInfo", {
		isDarwin: config.isDarwin
	});
	testInjector.register("xcodeSelectService", XcodeSelectService);

	return testInjector;
}
describe("xcode-select-service", () => {
	let injector: IInjector,
		service: IXcodeSelectService,
		defaultXcodeSelectStdout = "/Applications/Xcode.app/Contents/Developer/";

	beforeEach(() => {
		executionStopped = false;
	});

	it("gets correct path to Developer directory on Mac OS X whitout whitespaces", () => {
		injector = createTestInjector({ xcodeSelectStdout: "  /Applications/Xcode.app/Contents/Developer/  ", isDarwin: true });
		service = injector.resolve("$xcodeSelectService");

		assert.deepEqual(service.getDeveloperDirectoryPath().wait(), defaultXcodeSelectStdout, "xcode-select service should get correct trimmed  path to Developer directory on Mac OS X.");
	});

	it("gets correct path to Developer directory on Mac OS X whitout new lines", () => {
		injector = createTestInjector({ xcodeSelectStdout: "\r\n/Applications/Xcode.app/Contents/Developer/\n", isDarwin: true });
		service = injector.resolve("$xcodeSelectService");

		assert.deepEqual(service.getDeveloperDirectoryPath().wait(), defaultXcodeSelectStdout, "xcode-select service should get correct trimmed  path to Developer directory on Mac OS X.");
	});

	it("gets correct Xcode version", () => {
		injector = createTestInjector({ xcodeSelectStdout: null, isDarwin: true, xcodeVersionOutput: "Xcode 7.3\nBuild version 7D175" });
		service = injector.resolve("$xcodeSelectService");

		let xcodeVersion = service.getXcodeVersion().wait();

		assert.strictEqual(xcodeVersion.major, "7", "xcodeSelectService should get correct Xcode version");
		assert.strictEqual(xcodeVersion.minor, "3", "xcodeSelectService should get correct Xcode version");
	});

	it("gets correct path to Developer directory on Mac OS X", () => {
		injector = createTestInjector({ xcodeSelectStdout: defaultXcodeSelectStdout, isDarwin: true });
		service = injector.resolve("$xcodeSelectService");

		assert.deepEqual(service.getDeveloperDirectoryPath().wait(), defaultXcodeSelectStdout, "xcode-select service should get correct path to Developer directory on Mac OS X.");
	});

	it("gets correct path to Contents directory on Mac OS X", () => {
		// This path is constructed with path.join so that the tests are OS-agnostic
		let expected = path.join("/Applications", "Xcode.app", "Contents");
		injector = createTestInjector({ xcodeSelectStdout: defaultXcodeSelectStdout, isDarwin: true });
		service = injector.resolve("$xcodeSelectService");

		assert.deepEqual(service.getContentsDirectoryPath().wait(), expected, "xcode-select service should get correct path to Contents directory on Mac OS X.");
	});

	it("stops execution when trying to get Developer directory if not on Mac OS X", () => {
		injector = createTestInjector({ xcodeSelectStdout: defaultXcodeSelectStdout, isDarwin: false });
		service = injector.resolve("$xcodeSelectService");

		service.getDeveloperDirectoryPath().wait();

		assert.deepEqual(executionStopped, true, "xcode-select service should stop executon unless on Mac OS X.");
	});

	it("stops execution when trying to get Contents directory if not on Mac OS X", () => {
		injector = createTestInjector({ xcodeSelectStdout: defaultXcodeSelectStdout, isDarwin: false });
		service = injector.resolve("$xcodeSelectService");

		service.getContentsDirectoryPath().wait();

		assert.deepEqual(executionStopped, true, "xcode-select service should stop executon unless on Mac OS X.");
	});

	it("stops execution when Developer directory is empty on Mac OS X", () => {
		injector = createTestInjector({ xcodeSelectStdout: "", isDarwin: true });
		service = injector.resolve("$xcodeSelectService");

		service.getDeveloperDirectoryPath().wait();

		assert.deepEqual(executionStopped, true, "xcode-select service should stop executon when Developer directory is empty on Mac OS X.");
	});

	it("stops execution when Contents directory is empty on Mac OS X", () => {
		injector = createTestInjector({ xcodeSelectStdout: "", isDarwin: true });
		service = injector.resolve("$xcodeSelectService");

		service.getContentsDirectoryPath().wait();

		assert.deepEqual(executionStopped, true, "xcode-select service should stop executon when Contents directory is empty on Mac OS X.");
	});
});
