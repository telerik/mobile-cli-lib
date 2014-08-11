declare module "properties-parser" {
	function parse(text: string): any;
	function createEditor(path: string, callback: (err: IErrors, data: any) => void): IPropertiesParserEditor;
}

interface IPropertiesParserEditor {
	get(key: string): any;
	set(key: string, value: any, comment?: string): void;
	unset(key: string): void;
	save(path: string, callback: Function): void;
}