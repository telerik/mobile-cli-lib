///<reference path=".d.ts"/>
"use strict";

export class StringCommandParameter implements ICommandParameter {
	public mandatory = false;
	public errorMessage: string;

	constructor(private $injector: IInjector) { }

	public validate(validationValue: string): IFuture<boolean> {
		return (() => {
			if(!validationValue) {
				if(this.errorMessage) {
					this.$injector.resolve("errors").fail(this.errorMessage);
				}

				return false;
			}

			return true;
		}).future<boolean>()();
	}
}
$injector.register("stringParameter", StringCommandParameter);

export class StringParameterBuilder implements IStringParameterBuilder {
	constructor(private $injector: IInjector) { }

	public createMandatoryParameter(errorMsg: string) : ICommandParameter {
		let commandParameter = new StringCommandParameter(this.$injector);
		commandParameter.mandatory = true;
		commandParameter.errorMessage = errorMsg;

		return commandParameter;
	}
}
$injector.register("stringParameterBuilder", StringParameterBuilder);
