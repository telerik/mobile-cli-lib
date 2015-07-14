///<reference path="../.d.ts"/>
"use strict";

import helpers = require("../helpers");

export class MobileHelper implements Mobile.IMobileHelper {
	private static DEVICE_PATH_SEPARATOR = "/";	
	private platformNamesCache: string[];

	constructor(private $mobilePlatformsCapabilities: Mobile.IPlatformsCapabilities,
		private $errors: IErrors,
		private $devicePlatformsConstants: Mobile.IDevicePlatformsConstants) { }

	public get platformNames(): string[]{
		this.platformNamesCache = this.platformNamesCache ||
			_.map(this.$mobilePlatformsCapabilities.getPlatformNames(), platform => this.normalizePlatformName(platform));

		return this.platformNamesCache;
	}

	public getPlatformCapabilities(platform: string): Mobile.IPlatformCapabilities {
		let platformNames = this.$mobilePlatformsCapabilities.getPlatformNames();
		let validPlatformName = this.validatePlatformName(platform);
		if(!_.any(platformNames, platformName => platformName === validPlatformName)) {
			this.$errors.failWithoutHelp("'%s' is not a valid device platform. Valid platforms are %s.", platform, platformNames);
		}

		return this.$mobilePlatformsCapabilities.getAllCapabilities()[validPlatformName];
	}

	public isAndroidPlatform(platform: string): boolean {
		return this.$devicePlatformsConstants.Android.toLowerCase() === platform.toLowerCase();
	}

	public isiOSPlatform(platform: string): boolean {
		return this.$devicePlatformsConstants.iOS.toLowerCase() === platform.toLowerCase();
	}

	public isWP8Platform(platform: string): boolean {
		return this.$devicePlatformsConstants.WP8.toLowerCase() === platform.toLowerCase();
	}

	public normalizePlatformName(platform: string): string {
		if(this.isAndroidPlatform(platform)) {
			return "Android";
		} else if(this.isiOSPlatform(platform)) {
			return "iOS";
		} else if(this.isWP8Platform(platform)) {
			return "WP8";
		}

		return undefined;
	}

	public isPlatformSupported(platform: string): boolean {
		return _.contains(this.getPlatformCapabilities(platform).hostPlatformsForDeploy, process.platform);
	}

	public validatePlatformName(platform: string): string {
		if(!platform) {
			this.$errors.fail("No device platform specified.");
		}

		let normalizedPlatform = this.normalizePlatformName(platform);
		if(!normalizedPlatform || !_.contains(this.platformNames, normalizedPlatform)) {
			this.$errors.fail("'%s' is not a valid device platform. Valid platforms are %s.",
				platform, helpers.formatListOfNames(this.platformNames));
		}
		return normalizedPlatform;
	}
	
	public buildDevicePath(...args: string[]): string {
		return this.correctDevicePath(args.join(MobileHelper.DEVICE_PATH_SEPARATOR));
	}
	
	public correctDevicePath(filePath: string): string {
		return helpers.stringReplaceAll(filePath, '\\', '/'); 
	}
}
$injector.register("mobileHelper", MobileHelper);
