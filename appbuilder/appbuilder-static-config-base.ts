///<reference path="../.d.ts"/>
"use strict";

import { StaticConfigBase } from "../static-config-base";

export abstract class AppBuilderStaticConfigBase extends StaticConfigBase {
	constructor($injector: IInjector) {
		super($injector);
	}

	public get START_PACKAGE_ACTIVITY_NAME(): string {
		let project: Project.IProjectBase = $injector.resolve("project");
		return project.startPackageActivity;
	}
}
