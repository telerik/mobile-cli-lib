///<reference path="../.d.ts"/>
"use strict";

export class StringCommandParameter implements ICommandParameter {
	constructor(public mandatory?: boolean, public errorMessage?: string) { }

	public validate(validationValue: string): IFuture<boolean> {
		return (() => {
			if(!validationValue) {
				if(this.errorMessage) {
					$injector.resolve("errors").fail(this.errorMessage);
				}

				return false;
			}

			return true;
		}).future<boolean>()();
	}
}
$injector.register("stringParameter", StringCommandParameter);
