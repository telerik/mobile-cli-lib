import Fiber = require("fibers");
import Future = require("fibers/future");
import errors = require("./errors");

export function run(action: Function) {
	Fiber(() => {
		errors.installUncaughtExceptionListener();
		action();
		$injector.dispose();
		Future.assertNoFutureLeftBehind();
	}).run();
}

