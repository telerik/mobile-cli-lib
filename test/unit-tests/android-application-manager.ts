import { AndroidApplicationManager } from "../../mobile/android/android-application-manager";
import { Yok } from "../../yok";
import { assert } from "chai";


describe("android-application-manager", () => {

	let testInjector: IInjector,
		validTestInput: Array<string>,
		expectedValidTestInput: Array<string>;

	before(() => {
		testInjector = new Yok();
		expectedValidTestInput = [
			"org.nativescript.testApp/com.tns.TestClass",
			"org.nativescript.testApp/com.tns.$TestClass",
			"org.nativescript.testApp/com.tns._TestClass",
			"org.nativescript.testApp/com.tns.$_TestClass",
			"org.nativescript.testApp/com.tns._$TestClass"
		],
		validTestInput = [
			"other.stuff/ org.nativescript.testApp/com.tns.TestClass asdaas.dasdh2",
			"other.stuff.the.regex.might.fail.on org.nativescript.testApp/com.tns.$TestClass other.stuff.the.regex.might.fail.on",
			"/might.fail.on  org.nativescript.testApp/com.tns._TestClass /might.fail.on",
			"might.fail.on/ org.nativescript.testApp/com.tns.$_TestClass might.fail.on//",
			"/might.fail org.nativescript.testApp/com.tns._$TestClass something/might.fail.on/"
		]
	})
	beforeEach(() => {
		testInjector.register("androidApplicationManager", AndroidApplicationManager);
		testInjector.register("adb", {});
		testInjector.register('childProcess', {});
		testInjector.register("logger", {});
		testInjector.register("config", {});
		testInjector.register("staticConfig", {});
		testInjector.register("androidDebugBridgeResultHandler", {});
		testInjector.register("options", {});
		testInjector.register("errors", {});
		testInjector.register("identifier", {});
		testInjector.register("logcatHelper", {});
		testInjector.register("androidProcessService", {});
		testInjector.register("httpClient", {});
		testInjector.register("deviceLogProvider", {});
		testInjector.register("hooksService", {});
	});
	describe("tries to get fully qualified activity class name", () => {
		it("and succeeds finding the right name", async () => {
			let aam:AndroidApplicationManager = testInjector.resolve("androidApplicationManager");
			const fullActivityNameRegExp:RegExp = aam.getFullyQualifiedActivityRegex();
			const activityMatch = new RegExp(fullActivityNameRegExp, "m");

			for(let i = 0; i < validTestInput.length; i+=1) {
				let validInput = validTestInput[i];
				const match = activityMatch.exec(validInput);
				let expectedElement = expectedValidTestInput[i];

				assert.isArray(match);
				assert.isTrue(expectedElement == match[0]);
			}
			assert.isTrue(true);
		});
	});
});