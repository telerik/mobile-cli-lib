///<reference path="../../.d.ts"/>
"use strict";

import util = require("util");

export class MicroTemplateService implements IMicroTemplateService {
	private dynamicCallRegex: RegExp;

	constructor(private $dynamicHelpService: IDynamicHelpService,
		private $injector: IInjector) {
		// Injector's dynamicCallRegex doesn't have 'g' option, which we need here.
		// Use ( ) in order to use $1 to get whole expression later
		this.dynamicCallRegex = new RegExp(util.format("(%s)", this.$injector.dynamicCallRegex.source), "g");
	}

	public parseContent(data: string): string {
		var localVariables = this.$dynamicHelpService.getLocalVariables().wait();
		var compiledTemplate = _.template(data.replace(this.dynamicCallRegex, "this.$injector.dynamicCall(\"$1\").wait()"));
		// When debugging parsing, uncomment the line below:
		// console.log(compiledTemplate.source);
		return compiledTemplate.apply(this, [localVariables]);
	}
}
$injector.register("microTemplateService", MicroTemplateService);
