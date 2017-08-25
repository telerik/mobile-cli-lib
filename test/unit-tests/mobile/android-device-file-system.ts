import { AndroidDeviceFileSystem } from "../../../mobile/android/android-device-file-system";
import { Yok } from "../../../yok";
import { Errors } from "../../../errors";
import { FileSystem } from "../../../file-system";
import { Logger } from "../../../logger";
import { MobileHelper } from "../../../mobile/mobile-helper";
import { DevicePlatformsConstants } from "../../../mobile/device-platforms-constants";

import * as path from "path";
import { assert } from "chai";

const myTestAppIdentifier = "org.nativescript.myApp";
let isAdbPushExecuted = false;

class AndroidDebugBridgeMock {
	public executeCommand(args: string[]) {
		if (args[0] === "push") {
			isAdbPushExecuted = true;
		}

		return Promise.resolve();
	}

	public executeShellCommand() {
		return Promise.resolve();
	}
}

class LocalToDevicePathDataMock {
	constructor(private filePath: string) { }

	public getLocalPath(): string {
		return this.filePath;
	}

	public getDevicePath(): string {
		return "/data/local/tmp/" + path.basename(this.filePath);
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

	return injector;
}

function createAndroidDeviceFileSystem(injector: IInjector) {
	const adb = new AndroidDebugBridgeMock();
	const androidDeviceFileSystem = injector.resolve(AndroidDeviceFileSystem, { "adb": adb, "identifier": myTestAppIdentifier });
	androidDeviceFileSystem.createFileOnDevice = () => Promise.resolve();
	return androidDeviceFileSystem;
}

function createDeviceAppData() {
	return { getDeviceProjectRootPath: async () => "/data/local/tmp/sync", appIdentifier: myTestAppIdentifier };
}

describe("Android device file system tests", () => {
	describe("Transfer directory unit tests", () => {
		it("pushes the whole directory when hash file doesn't exist on device", async () => {
			const injector = createTestInjector();
			const deviceAppData = createDeviceAppData();

			const fileToShasumDictionary: IStringDictionary = {
				"~/TestApp/app/test.js": "1",
				"~/TestApp/app/myfile.js": "2"
			};
			const localToDevicePaths = _.keys(fileToShasumDictionary).map(file => injector.resolve(LocalToDevicePathDataMock, { filePath: file }));

			const fs = injector.resolve("fs");
			fs.getFileShasum = async (filePath: string) => fileToShasumDictionary[filePath];
			fs.exists = (filePath: string) => false;
			fs.getFsStats = mockFsStats({ isDirectory: false, isFile: true });

			const androidDeviceFileSystem = createAndroidDeviceFileSystem(injector);
			await androidDeviceFileSystem.transferDirectory(deviceAppData, localToDevicePaths, "~/TestApp/app");

			assert.isTrue(isAdbPushExecuted);
			isAdbPushExecuted = false;
		});

		it("pushes the whole directory when force option is specified", async () => {
			const injector = createTestInjector();

			const options = injector.resolve("options");
			options.force = true;

			const fs = injector.resolve("fs");
			fs.getFileShasum = async (filePath: string) => "0";

			const androidDeviceFileSystem = createAndroidDeviceFileSystem(injector);
			await androidDeviceFileSystem.transferDirectory(createDeviceAppData(), [], "~/TestApp/app");

			assert.isTrue(isAdbPushExecuted);
			isAdbPushExecuted = false;
		});

		it("pushes only changed file when hash file exists on device", async () => {
			const injector = createTestInjector();
			const deviceAppData = createDeviceAppData();

			const fileToShasumDictionary: IStringDictionary = {
				"~/TestApp/app/test.js": "1",
				"~/TestApp/app/myfile.js": "2"
			};
			const localToDevicePaths = _.keys(fileToShasumDictionary).map(file => injector.resolve(LocalToDevicePathDataMock, { filePath: file }));

			const fs = injector.resolve("fs");
			fs.getFileShasum = async (filePath: string) => fileToShasumDictionary[filePath];
			fs.exists = (filePath: string) => true;
			fs.readJson = (filePath: string) => ({ "~/TestApp/app/test.js": "0", "~/TestApp/app/myfile.js": "2" });
			fs.getFsStats = mockFsStats({ isDirectory: false, isFile: true });
			fs.readText = () => "";

			const androidDeviceFileSystem = createAndroidDeviceFileSystem(injector);
			let promise: Promise<void>;
			androidDeviceFileSystem.transferFile = (localPath: string, devicePath: string) => {
				assert.equal(localPath, "~/TestApp/app/test.js");
				promise = Promise.resolve();
				return Promise.resolve();
			};

			await androidDeviceFileSystem.transferDirectory(deviceAppData, localToDevicePaths, "~/TestApp/app");
			await promise;
		});

		it("pushes only changed files when hashes file exists on device", async () => {
			const injector = createTestInjector();
			const deviceAppData = createDeviceAppData();

			const fileToShasumDictionary: IStringDictionary = {
				"~/TestApp/app/test.js": "1",
				"~/TestApp/app/myfile.js": "2",
				"~/TestApp/app/notchangedFile.js": "3"
			};
			const localToDevicePaths = _.keys(fileToShasumDictionary).map(file => injector.resolve(LocalToDevicePathDataMock, { filePath: file }));

			const fs = injector.resolve("fs");
			fs.getFileShasum = async (filePath: string) => fileToShasumDictionary[filePath];
			fs.exists = (filePath: string) => true;
			fs.readJson = (filePath: string) => ({ "~/TestApp/app/test.js": "0", "~/TestApp/app/myfile.js": "4", "~/TestApp/app/notchangedFile.js": "3" });
			fs.getFsStats = mockFsStats({ isDirectory: false, isFile: true });
			fs.readText = () => "";

			const androidDeviceFileSystem = createAndroidDeviceFileSystem(injector);
			const transferedFilesOnDevice: string[] = [];
			androidDeviceFileSystem.transferFile = (localPath: string, devicePath: string) => {
				transferedFilesOnDevice.push(localPath);
				return Promise.resolve();
			};
			await androidDeviceFileSystem.transferDirectory(deviceAppData, localToDevicePaths, "~/TestApp/app");

			assert.equal(transferedFilesOnDevice.length, 2);
			assert.isTrue(_.includes(transferedFilesOnDevice, "~/TestApp/app/test.js"));
			assert.isTrue(_.includes(transferedFilesOnDevice, "~/TestApp/app/myfile.js"));
			assert.isFalse(_.includes(transferedFilesOnDevice, "~/TestApp/app/notchangedFile.js"));
		});

		it("pushes files which has different location when hash file exists on device", async () => {
			const injector = createTestInjector();
			const deviceAppData = createDeviceAppData();

			const fileToShasumDictionary: IStringDictionary = {
				"~/TestApp/app/newDir/test.js": "1",
				"~/TestApp/app/myfile.js": "2"
			};
			const localToDevicePaths = _.keys(fileToShasumDictionary).map(file => injector.resolve(LocalToDevicePathDataMock, { filePath: file }));

			const fs = injector.resolve("fs");
			fs.getFileShasum = (filePath: string) => fileToShasumDictionary[filePath];
			fs.exists = (filePath: string) => true;
			fs.readJson = (filePath: string) => ({ "~/TestApp/app/test.js": "0", "~/TestApp/app/myfile.js": "2" });
			fs.getFsStats = mockFsStats({ isDirectory: false, isFile: true });
			fs.readText = () => "";

			const androidDeviceFileSystem = createAndroidDeviceFileSystem(injector);
			androidDeviceFileSystem.transferFile = (localPath: string, devicePath: string) => {
				assert.equal(localPath, "~/TestApp/app/newDir/test.js");
				return Promise.resolve();
			};
			await androidDeviceFileSystem.transferDirectory(deviceAppData, localToDevicePaths, "~/TestApp/app");
		});

		it("pushes files which has different location and different shasum when hash file exists on device", async () => {
			const injector = createTestInjector();
			const deviceAppData = createDeviceAppData();

			const fileToShasumDictionary: IStringDictionary = {
				"~/TestApp/app/newDir/test.js": "2",
				"~/TestApp/app/myfile.js": "2"
			};
			const localToDevicePaths = _.keys(fileToShasumDictionary).map(file => injector.resolve(LocalToDevicePathDataMock, { filePath: file }));

			const fs = injector.resolve("fs");
			fs.getFileShasum = async (filePath: string) => fileToShasumDictionary[filePath];
			fs.exists = (filePath: string) => true;
			fs.readJson = (filePath: string) => ({ "~/TestApp/app/test.js": "0", "~/TestApp/app/myfile.js": "2" });
			fs.getFsStats = mockFsStats({ isDirectory: false, isFile: true });
			fs.readText = () => "";

			const androidDeviceFileSystem = createAndroidDeviceFileSystem(injector);
			androidDeviceFileSystem.transferFile = (localPath: string, devicePath: string) => {
				assert.equal(localPath, "~/TestApp/app/newDir/test.js");
				return Promise.resolve();
			};
			await androidDeviceFileSystem.transferDirectory(deviceAppData, localToDevicePaths, "~/TestApp/app");
		});
	});
});
