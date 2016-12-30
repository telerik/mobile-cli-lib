import * as bplistParser from "bplist-parser";

export class BPlistParser implements IBinaryPlistParser {

	public async parseFile(plistFilePath: string): Promise<any> {
		return new Promise<any>((resolve, reject) => {
			bplistParser.parseFile(plistFilePath, (err: Error, obj: any) => {
				if (err) {
					reject(err);
				} else {
					resolve(obj);
				}
			});
		});
	}
}
$injector.register("bplistParser", BPlistParser);
