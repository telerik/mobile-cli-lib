import * as propertiesParser from "properties-parser";
import * as assert from "assert";

export class PropertiesParser implements IPropertiesParser {
	private _editor: any = null;

	public parse(text: string): any {
		return propertiesParser.parse(text);
	}

	public async read(filePath: string): Promise<IStringDictionary> {
		return new Promise<IStringDictionary>((resolve, reject) => {
			propertiesParser.read(filePath, (err, data) => {
				if (err) {
					reject(err);
				} else {
					resolve(data);
				}
			});

		});
	}

	public createEditor(filePath: string) {
		return new Promise<any>((resolve, reject) => {
			propertiesParser.createEditor(filePath, (err, data) => {
				if (err) {
					reject(err);
				} else {
					this._editor = data;
					resolve(this._editor);
				}
			});

		});
	}

	public async saveEditor(): Promise<void> {
		assert.ok(this._editor, "Editor is undefied. Ensure that createEditor is called.");

		return new Promise<void>((resolve, reject) => {

			this._editor.save((err: any) => {
				if (err) {
					reject(err);
				} else {
					resolve();
				}
			});

		});
	}
}
$injector.register("propertiesParser", PropertiesParser);
