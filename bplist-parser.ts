import Future = require("fibers/future");
import * as bplistParser from "bplist-parser";

export class BPlistParser implements IBinaryPlistParser{

	public parseFile(plistFilePath: string): IFuture<any> {
		let future = new Future<any>();
		bplistParser.parseFile(plistFilePath, (err: Error, obj: any) => {
			if(err) {
				future.throw(err);
			} else {
				future.return(obj);
			}
		});
		return future;
	}
}
$injector.register("bplistParser", BPlistParser);
