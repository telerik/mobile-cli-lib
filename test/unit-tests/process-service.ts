import {Yok} from "../../yok";
import {ProcessService} from "../../services/process-service";
import {assert} from "chai";
import Future = require("fibers/future");

let processExitSignals = ["exit", "SIGINT", "SIGTERM"];

function createTestInjector(): IInjector {
	let testInjector = new Yok();

	testInjector.register("processService", ProcessService);

	return testInjector;
}

describe("Process service", () => {
	let testInjector: IInjector;
	let $processService: IProcessService;

	beforeEach(() => {
		testInjector = createTestInjector();
		$processService = testInjector.resolve("processService");
	});

	it("should not add only one listener for the exit, SIGIN and SIGTERM events.", () => {
		$processService.attachToProcessExitSignals({}, () => Future.fromResult());
		$processService.attachToProcessExitSignals({}, () => Future.fromResult());

		_.each(processExitSignals, (signal: string) => {
			// We need to search only for our listener because each exit signal have different listeners added to it.
			let actualListeners = _.filter(process.listeners(signal), (listener: Function) => listener.toString().indexOf("executeAllCallbacks") >= 0);
			assert.deepEqual(actualListeners.length, 1);
		});
	});

	it("should add listener with context only once if there already is callback with the same context.", () => {
		let context = { test: "test" };
		let listener = Future.fromResult(42);

		$processService.attachToProcessExitSignals(context, () => listener);
		$processService.attachToProcessExitSignals(context, () => listener);

		assert.deepEqual($processService.listenersCount, 1);
	});

	it("should add two different listeners for one context.", () => {
		let context = { test: "test" };
		let numberListener = Future.fromResult(42);
		let booleanListener = Future.fromResult(true);

		$processService.attachToProcessExitSignals(context, () => numberListener);
		$processService.attachToProcessExitSignals(context, () => booleanListener);

		assert.deepEqual($processService.listenersCount, 2);
	});

	it("should add one listener with different context twice.", () => {
		let listener = Future.fromResult(42);

		$processService.attachToProcessExitSignals({}, () => listener);
		$processService.attachToProcessExitSignals({}, () => listener);

		assert.deepEqual($processService.listenersCount, 2);
	});
});
