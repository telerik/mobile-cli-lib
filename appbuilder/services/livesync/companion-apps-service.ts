///<reference path="../../../.d.ts"/>
"use strict";

import { exported } from "../../../decorators";

const NS_COMPANION_APP_IDENTIFIER = "com.telerik.NativeScript";
const APPBUILDER_ANDROID_COMPANION_APP_IDENTIFIER = "com.telerik.AppBuilder";
const APPBUILDER_IOS_COMPANION_APP_IDENTIFIER = "com.telerik.Icenium";

// TODO: Detect when companion app is installed on any device and raise event.
// consider naming it CompanionAppService
export class CompanionAppsService implements ICompanionAppsService {
	constructor(private $projectConstants: IProjectConstants,
		private $mobileHelper: Mobile.IMobileHelper) { }

	@exported("companionAppsService")
	public getCompanionAppIdentifier(framework: string, platform: string): string {
		let lowerCasedFramework = (framework || "").toLowerCase();
		let lowerCasedPlatform = (platform || "").toLowerCase();

		if (lowerCasedFramework === this.$projectConstants.TARGET_FRAMEWORK_IDENTIFIERS.Cordova.toLowerCase()) {
			if(this.$mobileHelper.isAndroidPlatform(lowerCasedPlatform)) {
				return APPBUILDER_ANDROID_COMPANION_APP_IDENTIFIER;
			} else if(this.$mobileHelper.isiOSPlatform(lowerCasedPlatform)) {
				return APPBUILDER_IOS_COMPANION_APP_IDENTIFIER;
			}
		} else if (lowerCasedFramework === this.$projectConstants.TARGET_FRAMEWORK_IDENTIFIERS.NativeScript.toLowerCase()) {
			return NS_COMPANION_APP_IDENTIFIER;
		}

		return null;
	}
}
$injector.register("companionAppsService", CompanionAppsService);
