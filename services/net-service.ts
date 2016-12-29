import * as net from "net";
import Future = require("fibers/future");

export class Net implements INet {
	constructor(private $logger: ILogger) { }

	public async getFreePort(): Promise<number> {
		let server = net.createServer((sock: string) => { /* empty - noone will connect here */ });

		return new Promise<number>((resolve, reject) => {
			let isResolved = false;
			server.listen(0, () => {
				let portUsed = server.address().port;
				server.close();

				if (!isResolved) {
					isResolved = true;
					resolve(portUsed);
				}
			});

			server.on("error", (err: Error) => {
				if (!isResolved) {
					isResolved = true;
					reject(err);
				}
			});

		});
	}
}
$injector.register("net", Net);
