///<reference path=".d.ts"/>
"use strict";
import propertiesParser = require("properties-parser");
import Future = require("fibers/future");
import * as assert from "assert";

export class PropertiesParser implements IPropertiesParser {
	private _editor: any = null;
	
	public parse(text: string): any {
		return propertiesParser.parse(text);
	}
	
	public read(filePath: string): IFuture<IStringDictionary> {
		let future = new Future<IStringDictionary>();
		propertiesParser.read(filePath, (err, data) => {
			if(err) {
				future.throw(err);
			} else {
				future.return(data);
			}
		});
		
		return future;
	}

	public createEditor(filePath: string) {
		let future = new Future<any>();
		propertiesParser.createEditor(filePath,  (err, data) => {
			if(err) {
				future.throw(err);
			} else {
				this._editor = data;
				future.return(this._editor);
			}
		});

		return future;
	}
	
	public saveEditor(): IFuture<void> {
		assert.ok(this._editor, "Editor is undefied. Ensure that createEditor is called.");
		
		let future = new Future<void>();
		
		this._editor.save((err:any) => {
			if (err) {
				future.throw(err);
			} else {
				future.return();
			}
		});
		
		return future;
	}	
}
$injector.register("propertiesParser", PropertiesParser);
