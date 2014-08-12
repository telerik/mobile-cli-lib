declare module "watchr" {
	interface IWatchData {
		path?: string;
		paths?: string[];
		listeners: {
			error: (error:Error) => void;
			change: (changeType:string, filePath:string) => void;
			next?: {
				(error:Error, watcher:IWatcherInstance): void; // used with path
				(error:Error, watcher:IWatcherInstance[]): void; // used with paths
			}
		};
		next?: {
			(error:Error, watcher:IWatcherInstance): void; // used with path
			(error:Error, watcher:IWatcherInstance[]): void; // used with paths
		}
	}

	export interface IWatcherInstance {
		close: () => void;
	}

	export function watch(arg: IWatchData): void;
}
