///<reference path="../.d.ts"/>

import propertiesParser = require("properties-parser");
import Future = require("fibers/future");

export class PropertiesParser implements IPropertiesParser {
	public parse(text: string): any {
		return propertiesParser.parse(text);
	}

	public createEditor(filePath: string) {
		let future = new Future<any>();
		propertiesParser.createEditor(filePath,  (err, data) => {
			if(err) {
				future.throw(err);
			} else {
				future.return(data);
			}
		});

		return future;
	}
}
$injector.register("propertiesParser", PropertiesParser);