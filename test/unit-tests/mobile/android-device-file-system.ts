import { AndroidDeviceFileSystem } from "../../../mobile/android/android-device-file-system";
import { Yok } from "../../../yok";
import { Errors } from "../../../errors";
import { FileSystem } from "../../../file-system";
import { Logger } from "../../../logger";
import { MobileHelper } from "../../../mobile/mobile-helper";
import { DevicePlatformsConstants } from "../../../mobile/device-platforms-constants";

import * as path from "path";
import { assert } from "chai";
import { LiveSyncPaths } from "../../../constants";

const myTestAppIdentifier = "org.nativescript.myApp";
let isAdbPushExecuted = false;
let isAdbPushAppDirCalled = false;
let androidDeviceFileSystem: any;
let transferredFilesOnDevice: string[] = [];

class AndroidDebugBridgeMock {
	public executeCommand(args: string[]) {
		if (args[0] === "push") {
			isAdbPushExecuted = true;
			if (args.length >= 3 && args[2] === "/data/local/tmp/sync") {
				isAdbPushAppDirCalled = true;
			}
		}

		return Promise.resolve();
	}

	public executeShellCommand() {
		return Promise.resolve();
	}

	public async pushFile(localFilePath: string, deviceFilePath: string): Promise<void> {
		await this.executeCommand(['push', localFilePath, deviceFilePath]);
	}
}

class LocalToDevicePathDataMock {
	constructor(private filePath: string) { }

	public getLocalPath(): string {
		return this.filePath;
	}

	public getDevicePath(): string {
		return  `${LiveSyncPaths.ANDROID_TMP_DIR_NAME}/${path.basename(this.filePath)}`;
	}
}

class MobilePlatformsCapabilitiesMock implements Mobile.IPlatformsCapabilities {
	public getPlatformNames(): string[] {
		return _.keys(this.getAllCapabilities());
	}

	public getAllCapabilities(): IDictionary<Mobile.IPlatformCapabilities> {
		return {
			iOS: {
				"wirelessDeploy": false,
				"cableDeploy": true,
				"companion": false,
				"hostPlatformsForDeploy": ["darwin"]
			},
			Android: {
				"wirelessDeploy": false,
				"cableDeploy": true,
				"companion": false,
				"hostPlatformsForDeploy": ["win32", "darwin", "linux"]
			}
		};
	}
}

function mockFsStats(options: { isDirectory: boolean, isFile: boolean }): (filePath: string) => { isDirectory: () => boolean, isFile: () => boolean } {
	return (filePath: string) => ({
		isDirectory: (): boolean => options.isDirectory,
		isFile: (): boolean => options.isFile
	});
}

function createTestInjector(): IInjector {
	const injector = new Yok();
	injector.register("fs", FileSystem);
	injector.register("logger", Logger);
	injector.register("mobileHelper", MobileHelper);
	injector.register("config", {});
	injector.register("options", {});
	injector.register("errors", Errors);
	injector.register("mobilePlatformsCapabilities", MobilePlatformsCapabilitiesMock);
	injector.register("devicePlatformsConstants", DevicePlatformsConstants);
	injector.register("projectFilesManager", {});

	return injector;
}

function createAndroidDeviceFileSystem(injector: IInjector) {
	const adb = new AndroidDebugBridgeMock();
	const androidDeviceFS = injector.resolve(AndroidDeviceFileSystem, { "adb": adb, "identifier": myTestAppIdentifier });
	androidDeviceFS.createFileOnDevice = () => Promise.resolve();
	return androidDeviceFS;
}

function createDeviceAppData(androidVersion?: string) {
	return {
		getDeviceProjectRootPath: async () => `${LiveSyncPaths.ANDROID_TMP_DIR_NAME}/${LiveSyncPaths.SYNC_DIR_NAME}`, appIdentifier: myTestAppIdentifier,
		device: {
			deviceInfo: {
				version: androidVersion || "8.1.2"
			}
		}
	};
}

function setup(options?: {
	addHashesFile?: boolean,
	addUnmodifiedFile?: boolean,
	forceTransfer?: boolean
	deviceAndroidVersion?: string,
	modifiedFileLocalName?: string,
	unmodifiedFileLocalName?: string
}) {
	options = options || {};
	const projectRoot = "~/TestApp/app";
	const modifiedFileName = "test.js";
	const unmodifiedFileName = "notChangedFile.js";
	const modifiedFileLocalName = `${projectRoot}/${options.modifiedFileLocalName || modifiedFileName}`;
	const unmodifiedFileLocalName = `${projectRoot}/${options.unmodifiedFileLocalName || unmodifiedFileName}`;
	const filesToShasums: IStringDictionary = {};
	filesToShasums[modifiedFileLocalName] = "1";
	if (options.addUnmodifiedFile) {
		filesToShasums[unmodifiedFileLocalName] = "2";
	}
	const injector = createTestInjector();
	const deviceAppData = createDeviceAppData(options.deviceAndroidVersion);
	const opts = injector.resolve("options");
	opts.force = options.forceTransfer || false;
	const localToDevicePaths = _.keys(filesToShasums).map(file => injector.resolve(LocalToDevicePathDataMock, { filePath: file }));
	const fs = injector.resolve("fs");
	fs.getFileShasum = async (filePath: string) => filesToShasums[filePath];
	fs.exists = (filePath: string) => options.addHashesFile ? true : false;
	fs.readText = () => "";
	fs.readJson = (filePath: string) => {
		const deviceHashesFileContent: IStringDictionary = {};
		deviceHashesFileContent[`${projectRoot}/${modifiedFileName}`] = "11";
		if (options.addUnmodifiedFile) {
			deviceHashesFileContent[`${projectRoot}/${unmodifiedFileName}`] = "2";
		}

		return deviceHashesFileContent;
	};
	fs.getFsStats = mockFsStats({ isDirectory: false, isFile: true });

	androidDeviceFileSystem = createAndroidDeviceFileSystem(injector);
	androidDeviceFileSystem.transferFile = (localPath: string, devicePath: string) => {
		transferredFilesOnDevice.push(localPath);
	};

	isAdbPushExecuted = false;
	isAdbPushAppDirCalled = false;
	transferredFilesOnDevice = [];

	return {
		localToDevicePaths,
		deviceAppData,
		projectRoot,
		modifiedFileLocalName,
		unmodifiedFileLocalName
	};
}

describe("AndroidDeviceFileSystem", () => {
	describe("transferDirectory", () => {
		it("pushes the whole directory when hash file doesn't exist on device", async () => {
			const testSetup = setup({
				addHashesFile: false
			});

			await androidDeviceFileSystem.transferDirectory(testSetup.deviceAppData, testSetup.localToDevicePaths, testSetup.projectRoot);

			assert.isTrue(isAdbPushExecuted);
			assert.isTrue(isAdbPushAppDirCalled);
		});

		it("pushes the whole directory file by file on Android P when hash file doesn't exist on device", async () => {
			const testSetup = setup({
				addHashesFile: false,
				deviceAndroidVersion: "9"
			});

			await androidDeviceFileSystem.transferDirectory(testSetup.deviceAppData, testSetup.localToDevicePaths, testSetup.projectRoot);

			assert.isTrue(isAdbPushExecuted);
			assert.isFalse(isAdbPushAppDirCalled);
		});

		it("pushes the whole directory file by file on any future Android version when hash file doesn't exist on device", async () => {
			const testSetup = setup({
				addHashesFile: false,
				deviceAndroidVersion: "999"
			});

			await androidDeviceFileSystem.transferDirectory(testSetup.deviceAppData, testSetup.localToDevicePaths, testSetup.projectRoot);

			assert.isTrue(isAdbPushExecuted);
			assert.isFalse(isAdbPushAppDirCalled);
		});

		it("pushes the whole directory when force option is specified", async () => {
			const testSetup = setup({
				addHashesFile: false,
				forceTransfer: true
			});

			await androidDeviceFileSystem.transferDirectory(testSetup.deviceAppData, [], testSetup.projectRoot);

			assert.isTrue(isAdbPushExecuted);
			assert.isTrue(isAdbPushAppDirCalled);
		});

		it("pushes the whole directory file by file on Android P when force option is specified", async () => {
			const testSetup = setup({
				addHashesFile: false,
				forceTransfer: true,
				deviceAndroidVersion: "9"
			});

			await androidDeviceFileSystem.transferDirectory(testSetup.deviceAppData, [], testSetup.projectRoot);

			assert.isTrue(isAdbPushExecuted);
			assert.isFalse(isAdbPushAppDirCalled);
		});

		it("pushes only changed file when hash file exists on device", async () => {
			const testSetup = setup({
				addHashesFile: true
			});

			await androidDeviceFileSystem.transferDirectory(testSetup.deviceAppData, testSetup.localToDevicePaths, testSetup.projectRoot);

			assert.equal(transferredFilesOnDevice.length, 1);
			assert.equal(transferredFilesOnDevice[0], testSetup.modifiedFileLocalName);
			assert.isFalse(isAdbPushAppDirCalled);
		});

		it("pushes only changed files when hashes file exists on device", async () => {
			const testSetup = setup({
				addHashesFile: true,
				addUnmodifiedFile: true
			});

			await androidDeviceFileSystem.transferDirectory(testSetup.deviceAppData, testSetup.localToDevicePaths, testSetup.projectRoot);

			assert.equal(transferredFilesOnDevice.length, 1);
			assert.equal(transferredFilesOnDevice[0], testSetup.modifiedFileLocalName);
			assert.isFalse(isAdbPushAppDirCalled);
		});

		it("pushes files which has different location when hash file exists on device", async () => {
			const testSetup = setup({
				addHashesFile: true,
				addUnmodifiedFile: true,
				unmodifiedFileLocalName: "newLocation/notChangedFile.js"
			});

			await androidDeviceFileSystem.transferDirectory(testSetup.deviceAppData, testSetup.localToDevicePaths, testSetup.projectRoot);

			assert.equal(transferredFilesOnDevice.length, 2);
			assert.isTrue(_.includes(transferredFilesOnDevice, testSetup.unmodifiedFileLocalName));
			assert.isFalse(isAdbPushAppDirCalled);
		});

		it("pushes files which has different location and different shasum when hash file exists on device", async () => {
			const testSetup = setup({
				addHashesFile: true,
				modifiedFileLocalName: "newLocation/test.js"
			});

			await androidDeviceFileSystem.transferDirectory(testSetup.deviceAppData, testSetup.localToDevicePaths, testSetup.projectRoot);

			assert.equal(transferredFilesOnDevice.length, 1);
			assert.equal(transferredFilesOnDevice[0], testSetup.modifiedFileLocalName);
			assert.isFalse(isAdbPushAppDirCalled);
		});
	});
});
