///<reference path="../.d.ts"/>
"use strict";

export class StringCommandParameter implements ICommandParameter {
	public mandatory = false;
	public errorMessage: string;

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

export class StringParameterBuilder implements IStringParameterBuilder {
	public createMandatoryParameter(errorMsg: string) : ICommandParameter {
		var commandParameter = new StringCommandParameter();
		commandParameter.mandatory = true;
		commandParameter.errorMessage = errorMsg;

		return commandParameter;
	}
}
$injector.register("stringParameterBuilder", StringParameterBuilder);
