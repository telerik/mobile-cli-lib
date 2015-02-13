///<reference path="../.d.ts"/>
"use strict";

interface Function {
	$inject: {
		args: string[];
		name: string;
	};
}

interface Error {
	stack: string;
}

(<any>RegExp).escape = (s: string) => {
	return s.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
};
