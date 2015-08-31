///<reference path="../../.d.ts"/>
"use strict";

export class ClassWithFuturizedInitializeMethod {
	public initialize(): IFuture<void> {
		return (() => {
			this.isInitializedCalled = true;
		}).future<void>()();
	}

	public isInitializedCalled = false;
}

export class ClassWithInitializeMethod {
	public initialize(): void {
		this.isInitializedCalled = true;
	}

	public isInitializedCalled = false;
}
