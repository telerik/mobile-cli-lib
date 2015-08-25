declare module "bplist-parser" {
	export function parseBuffer(buff: NodeBuffer): any;
	export function parseFile(plistFilePath: string, callback?:(err: Error, obj: any) => void): any;
}
