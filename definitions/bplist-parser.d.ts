declare module "bplist-parser" {
	export function parseBuffer(buff: NodeBuffer): any;
	export function parseFile(plistFilePath: string): any;
}
