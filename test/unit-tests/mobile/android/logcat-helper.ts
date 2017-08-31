import { LogcatHelper } from "../../../../mobile/android/logcat-helper";
import { Yok } from "../../../../yok";
import { assert } from "chai";
import * as childProcess from "child_process";

class ChildProcessStub {
	public static methodCallCount = 0;
	private isWin = /^win/.test(process.platform);

	public spawn(command: string, args?: string[], options?: any): childProcess.ChildProcess {
		ChildProcessStub.methodCallCount++;
		let pathToExecutable = "";
		if (this.isWin) {
			pathToExecutable = "getcontent.bat";
		} else {
			pathToExecutable = "getcontent";
		}
		pathToExecutable = `${__dirname}/${pathToExecutable}`;
		const pathToSample = `${__dirname}/valid-sample.txt`;
		return childProcess.spawn(pathToExecutable, [pathToSample]);
	}
}

function createTestInjector(): IInjector {
	const injector = new Yok();
	injector.register("injector", injector);
	injector.register("logcatHelper", LogcatHelper);
	injector.register("logger", {
		debug(formatStr?: any, ...args: any[]): void {
			//left blank intentionally because of lint
		},
		trace(formatStr?: any, ...args: any[]): void {
			if (formatStr && formatStr.indexOf("ADB") !== -1) {
				//loghelper failed or socket closed"
				assert.isTrue(false);
			}
		}
	});
	injector.register("errors", {});
	injector.register("devicePlatformsConstants", { Android: "Android" });
	injector.register("processService", {
		attachToProcessExitSignals(context: any, callback: () => void): void {
			//left blank intentionally because of lint
		},
	});
	injector.register("deviceLogProvider", {
		logData(line: string, platform: string, deviceIdentifier: string): void {
			//left blank intentionally because of lint
		},
	});
	injector.register("childProcess", ChildProcessStub);
	injector.register("staticConfig", {
		async getAdbFilePath(): Promise<string> {
			return "";
		}
	});
	injector.register("androidDebugBridgeResultHandler", {});

	return injector;
}

describe("logcat-helper", () => {
	let injector: IInjector;
	let adbLogcatCrashedOrClosed: boolean;
	let loggedData: string[];

	beforeEach(() => {
		adbLogcatCrashedOrClosed = false;
		injector = createTestInjector();
		loggedData = [];
		ChildProcessStub.methodCallCount = 0;
	});

	describe("start", () => {
		it.only("whole logcat is read correctly", (done: mocha.Done) => {
			injector.register("deviceLogProvider", {
				logData(line: string, platform: string, deviceIdentifier: string): void {
					loggedData.push(line);
					if (line === "end") {
						assert.isAbove(loggedData.length, 0);
						done();
					}
				}
			});

			const logcatHelper: LogcatHelper = injector.resolve("logcatHelper");
			logcatHelper.start("valid-identifier");
		});
		it.only("if loghelper start is called multiple times with the same identifier it's a noop the second time", async () => {
			const logcatHelper: LogcatHelper = injector.resolve("logcatHelper");
			await logcatHelper.start("valid-identifier");
			assert.equal(ChildProcessStub.methodCallCount, 1);
			await logcatHelper.start("valid-identifier");
			assert.equal(ChildProcessStub.methodCallCount, 1);
			await logcatHelper.start("valid-identifier");
			assert.equal(ChildProcessStub.methodCallCount, 1);
		});
		it.only("if loghelper start works when it's called multiple times with different identifiers", async () => {
			const logcatHelper: LogcatHelper = injector.resolve("logcatHelper");
			await logcatHelper.start("valid-identifier1");
			assert.equal(ChildProcessStub.methodCallCount, 1);
			await logcatHelper.start("valid-identifier2");
			assert.equal(ChildProcessStub.methodCallCount, 2);
			await logcatHelper.start("valid-identifier3");
			assert.equal(ChildProcessStub.methodCallCount, 3);
		});
	});
	describe("stop", () => {
		it.only("device identifier is cleared on stop", async () => {
			const logcatHelper: LogcatHelper = injector.resolve("logcatHelper");
			await logcatHelper.start("valid-identifier");
			assert.equal(ChildProcessStub.methodCallCount, 1);
			await logcatHelper.stop("valid-identifier");
			await logcatHelper.start("valid-identifier");
			assert.equal(ChildProcessStub.methodCallCount, 2);
		});
		it.only("stop doesn't blow up if called multiple times", async () => {
			const logcatHelper: LogcatHelper = injector.resolve("logcatHelper");
			await logcatHelper.stop("valid-identifier");
			await logcatHelper.stop("valid-identifier");
			assert.isTrue(true);
		});
	});
});