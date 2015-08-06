///<reference path=".d.ts"/>
"use strict";

import Future = require("fibers/future");
let bplistParser = require('bplist-parser');

export class BPlistParser implements IBinaryPlistParser{
	constructor() { }
	
	public parseFile(plistFilePath: string): IFuture<any> {
		let future = new Future<any>();
		bplistParser.parseFile(plistFilePath, (err: any, obj: any) => {
			if(err) {
				future.throw(err);
			} else {
				future.return(obj);
			}
		});
		return future;
	}
}
$injector.register("bplistParser", BPlistParser);