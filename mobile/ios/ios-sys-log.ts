///<reference path="../../.d.ts"/>
"use strict";

require("../../bootstrap");
import fiberBootstrap = require("../../fiber-bootstrap");
import  {WinSocket} from "./ios-core";
fiberBootstrap.run(() => {
	let winSocket = $injector.resolve(WinSocket, {service: process.argv[2], format: process.argv[3]});
	winSocket.readSystemLogBlocking();
});
