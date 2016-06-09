require(process.argv[2]);
import * as fiberBootstrap from "../../../fiber-bootstrap";
import  {WinSocket} from "./ios-core";
fiberBootstrap.run(() => {
	let winSocket = $injector.resolve(WinSocket, {service: process.argv[3], format: process.argv[4]});
	winSocket.readSystemLogBlocking();
});
