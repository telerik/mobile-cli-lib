import { AppBuilderStaticConfigBase } from "./appbuilder-static-config-base";
import * as path from "path";

export class ProtonStaticConfig extends AppBuilderStaticConfigBase {
	constructor($injector: IInjector) {
		super($injector);
	}

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

	public CLIENT_NAME = "Desktop Client - Universal";
}
$injector.register("staticConfig", ProtonStaticConfig);
