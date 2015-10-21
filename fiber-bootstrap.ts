///<reference path=".d.ts"/>
"use strict";

import Fiber = require("fibers");
import Future = require("fibers/future");

export function run(action: any) {
	if(Fiber.current) {
		// Use the already existing fiber, we do not need new one.
		action();
	} else {
		Fiber(() => {
			action();
			// Call dispose method of $injector modules, which implement IDisposable.
			$injector.dispose();
			Future.assertNoFutureLeftBehind();
		}).run();
	}
}
