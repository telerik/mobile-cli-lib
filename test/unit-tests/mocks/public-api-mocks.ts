import { exportedPromise } from "../../../decorators";

export class TestPublicAPI {
	@exportedPromise("testPublicApi")
	public async myMethod(expectedResult: any): Promise<any> {
		return expectedResult;
	}
}
$injector.register("testPublicApi", TestPublicAPI);
