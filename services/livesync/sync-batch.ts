///<reference path="../../.d.ts"/>
"use strict";

import * as fiberBootstrap from "../../fiber-bootstrap";

// https://github.com/Microsoft/TypeScript/blob/master/src/compiler/tsc.ts#L487-L489
export const SYNC_WAIT_THRESHOLD = 250; //milliseconds

export class SyncBatch {
	private timer: NodeJS.Timer = null;
	private syncQueue: string[] = [];
	private syncInProgress: boolean = false;

	constructor(private $logger: ILogger,
		private $projectFilesManager: IProjectFilesManager,
		private done: () => IFuture<void>) { }

	private get filesToSync(): string[] {
		let filteredFiles = this.syncQueue.filter(syncFilePath => this.$projectFilesManager.isFileExcluded(syncFilePath));
		return filteredFiles;
	}

	public get syncPending(): boolean {
		return this.syncQueue.length > 0;
	}

	public syncFiles(syncAction: (filesToSync: string[]) => IFuture<void>): IFuture<void> {
		return (() => {
			if (this.filesToSync.length > 0) {
				syncAction(this.filesToSync).wait();
				this.reset();
			}
		}).future<void>()();
	}

	public addFile(filePath: string): void {
		if (this.timer) {
			clearTimeout(this.timer);
			this.timer = null;
		}

		this.syncQueue.push(filePath);

		if (!this.syncInProgress) {
			this.timer = setTimeout(() => {
				if (this.syncQueue.length > 0) {
					this.$logger.trace("Syncing %s", this.syncQueue.join(", "));
					fiberBootstrap.run(() => {
						try {
							this.syncInProgress = true;
							this.done().wait();
						} finally {
							this.syncInProgress = false;
						}
					});
				}
				this.timer = null;
			}, SYNC_WAIT_THRESHOLD);
		}
	}

	private reset(): void {
		this.syncQueue = [];
	}
}
