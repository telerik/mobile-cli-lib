declare module "rimraf" {
	function rmdir(path: string, callback: (error: Error) => void): void;
	function sync(path: string): void;
	export = rmdir;
}