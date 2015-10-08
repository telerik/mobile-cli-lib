///<reference path=".d.ts"/>
"use strict";

import Fiber = require("fibers");
import Future = require("fibers/future");
import errors = require("./errors");

export function run(action: any) {
	if(Fiber.current) {
		// Use the already existing fiber, we do not need new one.
		action();
	} else {
		Fiber(() => {
			errors.installUncaughtExceptionListener();
			action();
			// Call dispose method of $injector modules, which implement IDisposable.
			$injector.dispose();
			Future.assertNoFutureLeftBehind();
		}).run();
	}
}
