import { AndroidApplicationManager } from "../../mobile/android/android-application-manager";
import { Yok } from "../../yok";
import { assert } from "chai";
import { CommonLoggerStub } from "./stubs";
const invalidIdentifier: string = "invalid.identifier";

class AndroidDebugBridgeStub {
	public startedWithActivityManager: Boolean = false;
	public validIdentifierPassed: Boolean = false;
	public static methodCallCount: number = 0;
	private expectedValidTestInput: string[] = [
		"org.nativescript.testApp/com.tns.TestClass",
		"org.nativescript.testApp/com.tns.$TestClass",
		"org.nativescript.testApp/com.tns._TestClass",
		"org.nativescript.testApp/com.tns.$_TestClass",
		"org.nativescript.testApp/com.tns._$TestClass",
		"org.nativescript.testApp/com.tns.NativeScriptActivity"
	];
	private validTestInput: string[] = [
		"other.stuff/ org.nativescript.testApp/com.tns.TestClass asdaas.dasdh2",
		"other.stuff.the.regex.might.fail.on org.nativescript.testApp/com.tns.$TestClass other.stuff.the.regex.might.fail.on",
		"/might.fail.on  org.nativescript.testApp/com.tns._TestClass /might.fail.on",
		"might.fail.on/ org.nativescript.testApp/com.tns.$_TestClass might.fail.on//",
		"/might.fail org.nativescript.testApp/com.tns._$TestClass something/might.fail.on/",
		"android.intent.action.MAIN: \
			3b2df03 org.nativescript.testApp/com.tns.NativeScriptActivity filter 50dd82e \
			Action: \"android.intent.action.MAIN\" \
			Category: \"android.intent.category.LAUNCHER\" \
			-- \
			intent={act=android.intent.action.MAIN cat=[android.intent.category.LAUNCHER] flg=0x10200000 cmp=org.nativescript.testApp/com.tns.NativeScriptActivity} \
			realActivity=org.nativescript.testApp/com.tns.NativeScriptActivity \
			-- \
			Intent { act=android.intent.action.MAIN cat=[android.intent.category.LAUNCHER] flg=0x10200000 cmp=org.nativescript.testApp/com.tns.NativeScriptActivity } \
			frontOfTask=true task=TaskRecord{fe592ac #449 A=org.nativescript.testApp U=0 StackId=1 sz=1}"
	];

	public async executeShellCommand(args: string[]): Promise<any> {
		if (args && args.length > 0) {
			if (args[0] === "pm") {
				const passedIdentifier = args[2];
				if (passedIdentifier === invalidIdentifier) {
					return "invalid output string";
				} else {
					const testString = this.validTestInput[AndroidDebugBridgeStub.methodCallCount];
					return testString;
				}
			} else {
				this.startedWithActivityManager = this.checkIfStartedWithActivityManager(args);
				if (this.startedWithActivityManager) {
					this.validIdentifierPassed = this.checkIfValidIdentifierPassed(args);
				}
			}
		}
		AndroidDebugBridgeStub.methodCallCount++;
	}

	public async pushFile(localFilePath: string, deviceFilePath: string): Promise<void> {
		await this.executeShellCommand(["push", localFilePath, deviceFilePath ]);
	}

	public getInputLength(): number {
		return this.validTestInput.length;
	}

	private checkIfStartedWithActivityManager(args: string[]): Boolean {
		const firstArgument = args[0].trim();
		switch (firstArgument) {
			case "am": return true;
			case "monkey": return false;
			default: return false;
		}
	}

	private checkIfValidIdentifierPassed(args: string[]): Boolean {
		if (args && args.length) {
			const possibleIdentifier = args[args.length - 1];
			const validTestString = this.expectedValidTestInput[AndroidDebugBridgeStub.methodCallCount];

			return possibleIdentifier === validTestString;
		}
		return false;
	}
}

function createTestInjector(): IInjector {
	const testInjector = new Yok();
	testInjector.register("androidApplicationManager", AndroidApplicationManager);
	testInjector.register("adb", AndroidDebugBridgeStub);
	testInjector.register('childProcess', {});
	testInjector.register("logger", CommonLoggerStub);
	testInjector.register("config", {});
	testInjector.register("staticConfig", {});
	testInjector.register("androidDebugBridgeResultHandler", {});
	testInjector.register("options", { justlaunch: true });
	testInjector.register("errors", {});
	testInjector.register("identifier", {});
	testInjector.register("logcatHelper", {});
	testInjector.register("androidProcessService", {});
	testInjector.register("httpClient", {});
	testInjector.register("deviceLogProvider", {});
	testInjector.register("hooksService", {});
	return testInjector;
}

describe("android-application-manager", () => {

	let testInjector: IInjector;
	let androidApplicationManager: AndroidApplicationManager;
	let androidDebugBridge: AndroidDebugBridgeStub;

	beforeEach(() => {
		testInjector = createTestInjector();
		androidApplicationManager = testInjector.resolve("androidApplicationManager");
		androidDebugBridge = testInjector.resolve("adb");
	});
	describe("startApplication", () => {
		it("fires up the right application", async () => {
			for (let i = 0; i < androidDebugBridge.getInputLength(); i++) {
				androidDebugBridge.validIdentifierPassed = false;

				await androidApplicationManager.startApplication({ appId: "valid.identifier", projectName: "" });
				assert.isTrue(androidDebugBridge.validIdentifierPassed);
				assert.isTrue(androidDebugBridge.startedWithActivityManager);
			}
		});
		it("if regex fails monkey is called to start application", async () => {
			await androidApplicationManager.startApplication({ appId: invalidIdentifier, projectName: "" });
			assert.isFalse(androidDebugBridge.startedWithActivityManager);
		});
	});
});
