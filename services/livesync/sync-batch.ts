import * as fiberBootstrap from "../../fiber-bootstrap";

// https://github.com/Microsoft/TypeScript/blob/master/src/compiler/tsc.ts#L487-L489
export const SYNC_WAIT_THRESHOLD = 250; //milliseconds

export class SyncBatch {
	private _isTypeScriptProject: boolean;
	private hasCheckedProjectType: boolean;
	private timer: NodeJS.Timer = null;
	private syncQueue: string[] = [];
	private syncInProgress: boolean = false;

	constructor(private $logger: ILogger,
		private $projectFilesManager: IProjectFilesManager,
		private $project: Project.IProjectBase,
		private $typeScriptService: ITypeScriptService,
		private done: () => IFuture<void>) { }

	private get filesToSync(): string[] {
		let filteredFiles = this.syncQueue.filter(syncFile => !this.$projectFilesManager.isFileExcluded(syncFile));
		return filteredFiles;
	}

	public get syncPending(): boolean {
		return this.syncQueue.length > 0;
	}

	public syncFiles(syncAction: (filesToSync: string[]) => IFuture<void>): IFuture<void> {
		return (() => {
			if (this.isTypeScriptProject().wait()) {
				// We need to remove the TypeScript files from the sync queue because if we don't remove them we will run the transpilation twice.
				let typeScriptFiles = _.remove(this.syncQueue, this.$typeScriptService.isTypeScriptFile);

				// Check if there are any TypeScript files because if the array is empty the transpile method will transpile the whole project.
				if (typeScriptFiles.length) {
					this.$typeScriptService.transpile(this.$project.projectDir, typeScriptFiles).wait();
				}
			}

			if (this.filesToSync.length > 0) {
				syncAction(this.filesToSync).wait();
				this.reset();
			}
		}).future<void>()();
	}

	public addFile(file: string): void {
		if (this.timer) {
			clearTimeout(this.timer);
			this.timer = null;
		}

		this.syncQueue.push(file);

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

	private isTypeScriptProject(): IFuture<boolean> {
		return ((): boolean => {
			if (!this.hasCheckedProjectType) {
				this.hasCheckedProjectType = true;
				this._isTypeScriptProject = this.$typeScriptService.isTypeScriptProject(this.$project.projectDir).wait();
			}

			return this._isTypeScriptProject;
		}).future<boolean>()();
	}
}
