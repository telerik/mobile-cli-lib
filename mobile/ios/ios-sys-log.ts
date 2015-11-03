///<reference path="../../.d.ts"/>
"use strict";

require(process.argv[2]);
import fiberBootstrap = require("../../fiber-bootstrap");
import  {WinSocket} from "./ios-core";
fiberBootstrap.run(() => {
	let winSocket = $injector.resolve(WinSocket, {service: process.argv[3], format: process.argv[4]});
	winSocket.readSystemLogBlocking();
});
