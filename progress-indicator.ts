export class ProgressIndicator implements IProgressIndicator {
	constructor(private $logger: ILogger) { }

	public async showProgressIndicator(prom: Promise<any>, timeout: number, options?: { surpressTrailingNewLine?: boolean }): Promise<void> {
		let surpressTrailingNewLine = options && options.surpressTrailingNewLine;

		let isResolved = false;

		const tempPromise = new Promise<void>((resolve, reject) => {
			const postAction = (result: any) => isResolved = true;
			prom.then((res) => {
				isResolved = true;
				return res;
			}, (err) => {
				isResolved = true;
				throw err;
			});
		});

		try {
			while (!isResolved) {
				await this.$logger.printMsgWithTimeout(".", timeout);
			}

			// Make sure future is not left behind and prevent "There are outstanding futures." error.
			await tempPromise;
		} catch (err) {
			this.$logger.out();
			throw err;
		}

		if (!surpressTrailingNewLine) {
			this.$logger.out();
		}

	}
}
$injector.register("progressIndicator", ProgressIndicator);
