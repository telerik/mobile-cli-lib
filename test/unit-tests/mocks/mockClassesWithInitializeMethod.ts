export class ClassWithFuturizedInitializeMethod {
	public async initialize(): Promise<void> {
			this.isInitializedCalled = true;
	}

	public isInitializedCalled = false;
}

export class ClassWithInitializeMethod {
	public initialize(): void {
		this.isInitializedCalled = true;
	}

	public isInitializedCalled = false;
}
