interface IUnzipOptions {
	path: string;
}

interface ZipEntry extends NodeJS.ReadableStream {
	path: string;
	type: string;
	size: number;

	autodrain(): void;
}

declare module "unzip" {
	function Extract(opts: IUnzipOptions): NodeJS.WritableStream;
	function Parse(): NodeJS.WritableStream;
}