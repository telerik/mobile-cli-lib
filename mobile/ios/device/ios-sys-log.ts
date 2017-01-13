require(process.argv[2]);

import { WinSocket } from "./ios-core";

let winSocket = $injector.resolve(WinSocket, { service: process.argv[3], format: process.argv[4] });
winSocket.readSystemLogBlocking();
