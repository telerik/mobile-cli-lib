import * as fiber from "fibers";
import Future = require("fibers/future");

export function run(action: any) {
	if(fiber.current) {
		// Use the already existing fiber, we do not need new one.
		action();
	} else {
		fiber(() => {
			action();
			// Call dispose method of $injector modules, which implement IDisposable.
			$injector.dispose();
			Future.assertNoFutureLeftBehind();
		}).run();
	}
}
