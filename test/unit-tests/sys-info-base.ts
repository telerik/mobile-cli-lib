import {Yok} from "../../yok";
import * as assert from "assert";
import Future = require("fibers/future");
import {SysInfoBase} from "../../sys-info-base";
import * as temp from "temp";
import {writeFileSync} from "fs";
import * as path from "path";
//temp.track();

let toolsPackageJsonDir = temp.mkdirSync("dirWithPackageJson");
let toolsPackageJson = path.join(toolsPackageJsonDir, "package.json");
writeFileSync(toolsPackageJson, '{ "name": "unit-testing-doctor-service", "version": "1.0.0" }');

interface IChildProcessResultDescription {
	result?: any;
	shouldThrowError?: boolean;
}

interface IChildProcessResults {
	uname: IChildProcessResultDescription;
	npmV: IChildProcessResultDescription;
	javaVersion: IChildProcessResultDescription;
	javacVersion: IChildProcessResultDescription;
	nodeGypVersion: IChildProcessResultDescription;
	xCodeVersion: IChildProcessResultDescription;
	adbVersion: IChildProcessResultDescription;
	androidInstalled: IChildProcessResultDescription;
	monoVersion: IChildProcessResultDescription;
	gradleVersion: IChildProcessResultDescription;
	gitVersion: IChildProcessResultDescription;
	podVersion: IChildProcessResultDescription;
}

function getResultFromChildProcess(childProcessResultDescription: IChildProcessResultDescription): any {
	if(childProcessResultDescription.shouldThrowError) {
		throw new Error("This one throws error.");
	}

	return childProcessResultDescription.result;
}

function createChildProcessResults(childProcessResult: IChildProcessResults): IDictionary<IChildProcessResultDescription> {
	return {
		"uname -a": childProcessResult.uname,
		"npm -v": childProcessResult.npmV,
		"java": childProcessResult.javaVersion,
		'"javac" -version': childProcessResult.javacVersion,
		"node-gyp -v": childProcessResult.nodeGypVersion,
		"xcodebuild -version": childProcessResult.xCodeVersion,
		"pod --version": childProcessResult.podVersion,
		'"adb" version': childProcessResult.adbVersion,
		"'adb' version": childProcessResult.adbVersion, // for Mac and Linux
		'android': childProcessResult.androidInstalled,
		"mono --version": childProcessResult.monoVersion,
		"git --version": childProcessResult.gitVersion,
		"gradle -v": childProcessResult.gradleVersion
	};
}

function createTestInjector(childProcessResult: IChildProcessResults, hostInfoData: {isWindows: boolean, dotNetVersion: string, isDarwin: boolean}, itunesError: string): IInjector {
	let injector = new Yok();
	let childProcessResultDictionary = createChildProcessResults(childProcessResult);
	injector.register("childProcess", {
		exec: (command: string, options?: any, execOptions?: IExecOptions) => {
			return (() => {
				return getResultFromChildProcess(childProcessResultDictionary[command]);
			}).future<any>()();
		},

		spawnFromEvent: (command: string, args: string[], event: string) => {
			return (() => {
				return getResultFromChildProcess(childProcessResultDictionary[command]);
			}).future<any>()();
		}
	});

	injector.register("hostInfo", {
		dotNetVersion: () => Future.fromResult(hostInfoData.dotNetVersion),
		isWindows: hostInfoData.isWindows,
		isDarwin: hostInfoData.isDarwin
	});

	injector.register("iTunesValidator", {
		getError: () => Future.fromResult(itunesError)
	});

	injector.register("logger", {
		trace: (formatStr?: any, ...args: string[]) => { /* intentionally left blank */}
	});

	injector.register("winreg", {
		getRegistryValue: (valueName: string, hive?: IHiveId, key?: string, host?: string) => { return {value: "registryKey"}; },
		registryKeys: {
			HKLM: "HKLM"
		}
	});

	injector.register("sysInfoBase", SysInfoBase);

	return injector;
}

describe("sysInfoBase", () => {
	// TODO: Add tests when JAVA_HOME is set and when it is not
	let originalJavaHome = process.env.JAVA_HOME;
	process.env.JAVA_HOME = '';

	after(() => process.env.JAVA_HOME = originalJavaHome);

	let childProcessResult: IChildProcessResults,
		testInjector: IInjector,
		sysInfoBase: ISysInfo;

	beforeEach(() => {
		childProcessResult = {
			uname: { result: "name" },
			npmV: { result: "2.14.1" },
			javaVersion: { result: {stderr: 'java version "1.8.0_60"'} },
			javacVersion: { result: {stderr: 'javac 1.8.0_60'} },
			nodeGypVersion: { result: "2.0.0" },
			xCodeVersion: { result: "6.4.0" },
			adbVersion: { result: "Android Debug Bridge version 1.0.32" },
			androidInstalled: { result: { stdout: "android" } },
			monoVersion: { result: "version 1.0.6 " },
			gradleVersion: { result: "Gradle 2.8" },
			gitVersion: { result: "git version 1.9.5" },
			podVersion: { result: "0.38.2" },
		};

		testInjector = null;
		sysInfoBase = null;
	});
	describe("getSysInfo", () => {
		describe("returns correct results when everything is installed", () => {
			let assertCommonValues = (result: ISysInfoData) => {
				assert.deepEqual(result.npmVer, childProcessResult.npmV.result);
				assert.deepEqual(result.javaVer, "1.8.0");
				assert.deepEqual(result.javacVersion, "1.8.0_60");
				assert.deepEqual(result.nodeGypVer, childProcessResult.nodeGypVersion.result);
				assert.deepEqual(result.adbVer, childProcessResult.adbVersion.result);
				assert.deepEqual(result.androidInstalled, true);
				assert.deepEqual(result.monoVer, "1.0.6");
				assert.deepEqual(result.gradleVer, "2.8");
				assert.deepEqual(result.gitVer, "1.9.5");
			};

			it("on Windows", () => {
				testInjector = createTestInjector(childProcessResult, {isWindows: true, isDarwin: false, dotNetVersion: "4.5.1"}, null);
				sysInfoBase = testInjector.resolve("sysInfoBase");
				let result = sysInfoBase.getSysInfo(toolsPackageJson).wait();
				assertCommonValues(result);
				assert.deepEqual(result.xcodeVer, null);
				assert.deepEqual(result.cocoapodVer, null);
			});

			it("on Mac", () => {
				testInjector = createTestInjector(childProcessResult, {isWindows: false, isDarwin: true, dotNetVersion: "4.5.1"}, null);
				sysInfoBase = testInjector.resolve("sysInfoBase");
				let result = sysInfoBase.getSysInfo(toolsPackageJson).wait();
				assertCommonValues(result);
				assert.deepEqual(result.xcodeVer, childProcessResult.xCodeVersion.result);
				assert.deepEqual(result.cocoapodVer, childProcessResult.podVersion.result);
			});

			it("on Linux", () => {
				testInjector = createTestInjector(childProcessResult, {isWindows: false, isDarwin: false, dotNetVersion: "4.5.1"}, null);
				sysInfoBase = testInjector.resolve("sysInfoBase");
				let result = sysInfoBase.getSysInfo(toolsPackageJson).wait();
				assertCommonValues(result);
				assert.deepEqual(result.xcodeVer, null);
				assert.deepEqual(result.cocoapodVer, null);
			});
		});

		describe("cocoapods version", () => {
			it("is null when cocoapods are not installed", () => {
				// simulate error when pod --version command is executed
				childProcessResult.podVersion = { shouldThrowError: true };
				testInjector = createTestInjector(childProcessResult, {isWindows: false, isDarwin: true, dotNetVersion: "4.5.1"}, null);
				sysInfoBase = testInjector.resolve("sysInfoBase");
				let result = sysInfoBase.getSysInfo(toolsPackageJson).wait();
				assert.deepEqual(result.cocoapodVer, null);
			});

			it("is null when OS is not Mac", () => {
				testInjector = createTestInjector(childProcessResult, {isWindows: true, isDarwin: false, dotNetVersion: "4.5.1"}, null);
				sysInfoBase = testInjector.resolve("sysInfoBase");
				let result = sysInfoBase.getSysInfo(toolsPackageJson).wait();
				assert.deepEqual(result.cocoapodVer, null);
			});

			it("is correct when cocoapods output has warning after version output", () => {
				childProcessResult.podVersion = { result: "0.38.2\nWARNING:\n" };
				testInjector = createTestInjector(childProcessResult, {isWindows: false, isDarwin: true, dotNetVersion: "4.5.1"}, null);
				sysInfoBase = testInjector.resolve("sysInfoBase");
				let result = sysInfoBase.getSysInfo(toolsPackageJson).wait();
				assert.deepEqual(result.cocoapodVer, "0.38.2");
			});

			it("is correct when cocoapods output has warnings before version output", () => {
				childProcessResult.podVersion = { result: "WARNING\nWARNING2\n0.38.2" };
				testInjector = createTestInjector(childProcessResult, {isWindows: false, isDarwin: true, dotNetVersion: "4.5.1"}, null);
				sysInfoBase = testInjector.resolve("sysInfoBase");
				let result = sysInfoBase.getSysInfo(toolsPackageJson).wait();
				assert.deepEqual(result.cocoapodVer, "0.38.2");
			});
		});

		describe("returns correct results when exceptions are raised during sysInfo data collection", () => {
			beforeEach(() => {
				childProcessResult = {
					uname: { shouldThrowError: true },
					npmV: { shouldThrowError: true },
					javaVersion: { shouldThrowError: true },
					javacVersion: { shouldThrowError: true },
					nodeGypVersion: { shouldThrowError: true },
					xCodeVersion: { shouldThrowError: true },
					adbVersion: { shouldThrowError: true },
					androidInstalled: { shouldThrowError: true },
					monoVersion: { shouldThrowError: true },
					gradleVersion: { shouldThrowError: true },
					gitVersion: { shouldThrowError: true },
					podVersion: { shouldThrowError: true },
				};
			});

			describe("when android info is incorrect", () => {
				it("pathToAdb and pathToAndroid are null", () => {
					childProcessResult.adbVersion = {
						result: null
					};
					childProcessResult.androidInstalled = {
						result: false
					};
					testInjector = createTestInjector(childProcessResult, {isWindows: false, isDarwin: false, dotNetVersion: "4.5.1"}, null);
					sysInfoBase = testInjector.resolve("sysInfoBase");
					let result = sysInfoBase.getSysInfo(toolsPackageJson, {pathToAdb: null, pathToAndroid: null}).wait();
					assert.deepEqual(result.adbVer, null);
					assert.deepEqual(result.androidInstalled, false);
				});
			});

			describe("when all of calls throw", () => {
				let assertAllValuesAreNull = () => {
					sysInfoBase = testInjector.resolve("sysInfoBase");
					let result = sysInfoBase.getSysInfo(toolsPackageJson).wait();
					assert.deepEqual(result.npmVer, null);
					assert.deepEqual(result.javaVer, null);
					assert.deepEqual(result.javacVersion, null);
					assert.deepEqual(result.nodeGypVer, null);
					assert.deepEqual(result.xcodeVer, null);
					assert.deepEqual(result.adbVer, null);
					assert.deepEqual(result.androidInstalled, false);
					assert.deepEqual(result.monoVer, null);
					assert.deepEqual(result.gradleVer, null);
					assert.deepEqual(result.gitVer, null);
					assert.deepEqual(result.cocoapodVer, null);
				};

				it("on Windows", () => {
					testInjector = createTestInjector(childProcessResult, {isWindows: true, isDarwin: false, dotNetVersion: "4.5.1"}, null);
					assertAllValuesAreNull();
				});

				it("on Mac", () => {
					testInjector = createTestInjector(childProcessResult, {isWindows: false, isDarwin: true, dotNetVersion: "4.5.1"}, null);
					assertAllValuesAreNull();
				});

				it("on Linux", () => {
					testInjector = createTestInjector(childProcessResult, {isWindows: false, isDarwin: false, dotNetVersion: "4.5.1"}, null);
					assertAllValuesAreNull();
				});
			});
		});
	});
});
