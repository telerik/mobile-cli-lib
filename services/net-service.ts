import * as net from "net";

export class Net implements INet {
	constructor(private $errors: IErrors) { }

	public async getFreePort(): Promise<number> {
		const server = net.createServer((sock: string) => { /* empty - noone will connect here */ });

		return new Promise<number>((resolve, reject) => {
			let isResolved = false;
			server.listen(0, () => {
				const portUsed = server.address().port;
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

	public async isPortAvailable(port: number): Promise<boolean> {
		return new Promise<boolean>((resolve, reject) => {
			let isResolved = false;
			const server = net.createServer();

			server.on("error", (err: Error) => {
				if (!isResolved) {
					isResolved = true;
					resolve(false);
				}
			});

			server.once("close", () => {
				if (!isResolved) { // "close" will be emitted right after "error"
					isResolved = true;
					resolve(true);
				}
			});

			server.on("listening", (err: Error) => {
				if (err && !isResolved) {
					isResolved = true;
					resolve(true);
				}

				server.close();
			});

			server.listen(port, "localhost");
		});
	}

	public async getAvailablePortInRange(startPort: number, endPort?: number): Promise<number> {
		endPort = endPort || 65534;
		while (!(await this.isPortAvailable(startPort))) {
			startPort++;
			if (startPort > endPort) {
				this.$errors.failWithoutHelp("Unable to find free local port.");
			}
		}

		return startPort;
	}
}

$injector.register("net", Net);
