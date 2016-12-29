import Future = require("fibers/future");

export class Queue<T> implements IQueue<T> {
	private future: Promise<void>;

	public constructor(private items?: T[]) {
		this.items = this.items === undefined ? [] : this.items;
	}

	public enqueue(item: T): void {
		this.items.unshift(item);

		if (this.future) {
			this.future.return();
		}
	}

	public async dequeue(): Promise<T> {
			if (!this.items.length) {
				this.future = new Promise<void>((resolve, reject) => {

				});
				await this.future;
				this.future = null;
			}

			return this.items.pop();
	}
}
