///<reference path=".d.ts"/>

"use strict";

import xopen = require("open");

export class Opener implements IOpener {
	
    public open(target: string, appname?: string): any {
        return xopen(target, appname);
	}
}
$injector.register("opener", Opener);
