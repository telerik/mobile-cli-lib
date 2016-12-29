// Type definitions for node-fibers
// Project: https://github.com/laverdet/node-fibers
// Definitions by: Cary Haynie <https://github.com/caryhaynie>
// Definitions: https://github.com/borisyankov/DefinitelyTyped

interface Fiber {
	reset: () => any;
	run: (param?: any) => any;
	throwInto: (ex: any) => any;
}

interface Promise<T> {
	detach(): void;
	get(): T;
	isResolved (): boolean;
	proxy<U>(future: Promise<U>): void;
	async proxyErrors(future: Promise<any>): Promise<T>;
	async proxyErrors(futureList: Promise<any>[]): Promise<T>;
	resolver(): Function;
	resolve(fn: (err: any, result?: T) => void): void;
	resolveSuccess(fn: (result: T) => void): void;
	return(result?: T): void;
	throw(error: any): void;
	wait(): T;
	error: Error;
}

declare module "fibers" {

	function Fiber(fn: Function): Fiber;

	module Fiber {
		export var current: Fiber;
		export function yield(value?: any): any
	}

export = Fiber;
}

interface ICallableFuture<T> {
	(...args: any[]): Promise<T>;
}

interface IFutureFactory<T> {
	(): Promise<T>;
}

interface Function {
	future<T>(...args: any[]): IFutureFactory<T>;
}

declare module "fibers/future" {

	class Future<T> implements Promise<T> {
		constructor();
		detach(): void;
		get(): T;
		isResolved (): boolean;
		proxy<U>(future: Promise<U>): void;
		async proxyErrors(future: Promise<any>): Promise<T>;
		async proxyErrors(futureList: Promise<any>[]): Promise<T>;
		resolver(): Function;
		resolve(fn: Function): void;
		resolveSuccess(fn: Function): void;
		return(result?: T): void;
		throw (error: any): void;
		wait(): T;
		error: Error;

		static task<T>(fn: Function): Promise<T>;

		static wait<T>(future: Promise<T>): void;
		static wait(future_list: Promise<any>[]): void;
		static wait(...future_list: Promise<any>[]): void;

		static settle<T>(future: Promise<T>): void;
		static settle(future_list: Promise<any>[]): void;
		static settle(...future_list: Promise<any>[]): void;

		static fromResult<T>(value: T): Promise<T>;
		static fromResult<T>(value: any): Promise<T>;
		static fromResult(): Promise<void>;

		static assertNoFutureLeftBehind(): void;
	}

export = Future;
}