import { isInteractive } from './helpers';

const clui = require("clui");

export class ProgressIndicator implements IProgressIndicator {
	constructor(private $logger: ILogger) { }

	public async showProgressIndicator<T>(promise: Promise<T>, timeout: number, options?: { surpressTrailingNewLine?: boolean }): Promise<T> {
		const surpressTrailingNewLine = options && options.surpressTrailingNewLine;

		let isFulfilled = false;

		const tempPromise = new Promise<T>((resolve, reject) => {
			promise.then((res) => {
				isFulfilled = true;
				resolve(res);
			}, (err) => {
				isFulfilled = true;
				reject(err);
			});
		});

		if (!isInteractive()) {
			while (!isFulfilled) {
				await this.$logger.printMsgWithTimeout(".", timeout);
			}
		}

		if (!surpressTrailingNewLine) {
			this.$logger.out();
		}

		return tempPromise;
	}

	public getSpinner(message: string): ISpinner {
		if (isInteractive()) {
			return new clui.Spinner(message);
		} else {
			let msg = message;
			return {
				start: () => this.$logger.info(msg),
				message: (newMsg: string) => msg = newMsg,
				stop: (): void => undefined
			};
		}
	}
}
$injector.register("progressIndicator", ProgressIndicator);
