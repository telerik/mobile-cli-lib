declare module "properties-parser" {
	function parse(text: string): any;
	function createEditor(path: string, callback: (err: IErrors, data: any) => void);
}