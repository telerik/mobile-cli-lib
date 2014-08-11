declare module "watchr" {
	export interface IWatchData {
		path?: string;
		paths?: string[];
		listeners: {
			error: (error: string) => void;
			change: (changeType: string, filePath: string) => void;
		};
	}

	export interface IWatcherInstance {
		close: () => void;
	}

	export function watch(arg: IWatchData): void;
}
