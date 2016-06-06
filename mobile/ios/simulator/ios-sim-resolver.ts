export class IOSSimResolver implements Mobile.IiOSSimResolver {
	private static iOSSimName = "ios-sim-portable";

	private _iOSSim: any = null;
	public get iOSSim(): any {
		if (!this._iOSSim) {
			this._iOSSim = require(IOSSimResolver.iOSSimName);
		}

		return this._iOSSim;
	}

	public get iOSSimPath(): string {
		return require.resolve(IOSSimResolver.iOSSimName);
	}
}
$injector.register("iOSSimResolver", IOSSimResolver);
