mobile-cli-lib
==============

Contains common infrastructure for CLIs - mainly AppBuilder and NativeScript.

Public API
==

This section contains information about each public method. All methods return Promise.

### How to make a method public
In order to expose public API, we use TypeScript decorators and some "magic" in our bootstrapping. When you want to expose method `B` from class `A`, you have to do the following:
* In `bootstrap.ts` make sure to use `requirePublic` method of the `$injector` when requiring the class:
	```TypeScript
	$injector.requirePublic("a", "./pathToFileWhereAClassIs")
	```
* On the method which you want to expose, just add the exported decorator: `@decorators.exported('a')`, where decorators are imported from the root of the project: `import decorators = require("./decorators");`

> IMPORTANT: `exported` decorator requires one parameter which MUST be the first parameter passed to `requirePublic` method. This is the name of the module that will be publicly exposed.

After you have executed these two steps, you can start using your publicly available method:

```JavaScript
var common = require("mobile-cli-lib");
common.a.B() /* NOTE: here we are not using the class name A, but the module name - a */
	.then(function (a) {
    	console.log("After promise had returned.");
    	return a;
	})
    .catch(function (err) {
    	console.log("Error happened:");
    	console.log(err);
	});
```

#### Behind the scenes of generating public API
`requirePublic` method of the `injector` is doing some "magic" in order to support lazy loading, correct dependency resolving and exposing only some of the methods, not the whole power that is available.
When you require `mobile-cli-lib` module, you receive $injector's publicApi - it is the "exported one". `requirePublic` method defines getter for each module that is passed, for example when you say:
```TypeScript
	$injector.requirePublic("a", "./pathToFileWhereAClassIs")
```
a new property is added to publicApi - `a` and a getter is added for it. When you try to access this module, `require("mobile-cli-lib").a.<smth>`, the getter is called. It resolves the module, by parsing the provided file (`./pathToFileWhereAClassIs`)
and that's the time when decorators are executed. For each decorated method, a new entry in `$injector.publicApi.__modules__` is created. This is not the same method that you've decorated - it's entirely new method, that returns Promise.
The new method will be used in the publicApi, while original implementation will still be used in all other places in the code. The promisified method will call the original one (in a separate Fiber) and will resolve the Promise with the result of the method.

### Module fs
> Stability: 0 - Only for testing purposes. Will be removed.

For testing purposes we have exposed fs module and one of its methods: getFileSize. It's signature is:
`getFileSize(path: string): number`
This method throws exception in case the passed path does not exist.

Example usage:
```JavaScript
var common = require("mobile-cli-lib");
common.fs.getFileSize("D:\\Work\\t.txt")
    .then(function (a) {
    	console.log("File size is: ");
    	console.log(a);
    	return a;
	})
    .catch(function (err) {
    	console.log("Error happened:");
    	console.log(err);
	});
```

Issues
==

### Better error handling

Currently all promises are `resolved` - add logic to `reject` them.

### Missing dependencies

Some of our modules must be added: staticConfig, config, analyticsService, etc.

### Tests for injector

Add more tests for yok and for register decorator.