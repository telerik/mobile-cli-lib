///<reference path="../.d.ts"/>
"use strict";

import {StaticConfigBase} from "../static-config-base";
import * as path from "path";

export class ProtonStaticConfig extends StaticConfigBase {
	constructor($injector: IInjector) {
		super($injector);
	}
	public START_PACKAGE_ACTIVITY_NAME = ".TelerikCallbackActivity";

	public getAdbFilePath(): IFuture<string> {
		return (() => {
			let value = super.getAdbFilePath().wait();
			return value.replace("app.asar", "app.asar.unpacked");
		}).future<string>()();
	}

	public get PATH_TO_BOOTSTRAP(): string {
		return path.join(__dirname, "proton-bootstrap");
	}

	public disableAnalytics = true;
}
$injector.register("staticConfig", ProtonStaticConfig);
