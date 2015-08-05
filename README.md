mobile-cli-lib
==============

Provides an easy way for working with devices.
Contains common infrastructure for CLIs - mainly AppBuilder and NativeScript.

Installation
===

Latest version: 0.0.1 
Release date: To be determined

### System Requirements

Before installing the `mobile-cli-lib`, verify that your system meets the following requirements.

#### Windows Systems

**Minimum Software Requirements**

* Windows 7 or later
* .NET 4.0 or later
* Node.js
	* (Windows 7 systems): Node.js 0.10.26 or a later stable official release except 0.10.34<br/>A [known issue](https://github.com/joyent/node/issues/8894) prevents the `mobile-cli-lib` from working properly with Node.js 0.10.34.
	* (Windows 8 and later systems): Node.js 0.12.0 or a later stable official release<br/>A [known issue](https://github.com/SBoudrias/Inquirer.js/issues/235) in Inquirer.js prevents the interactive prompts from working properly in `cmd` shells on Windows 8 or later systems with Node.js 0.10.x.

> To be able to work with connected iOS devices from the command line, download and install the 32-bit Node.js.<br/>You can download and install the 32-bit Node.js from the <a href="http://nodejs.org/download/" target="_blank">Node.js web site</a>.

**Additional Software Requirements for iOS On-Device Deployment**

* iTunes (latest official)
* Node.js

> The bitness of Node.js and iTunes must match.

**Additional Software Requirements for Android On-Device Deployment**

* Device drivers required by your system to recognize the connected Android device
* For testing in the native emulators
	* JDK 8 or later
	* Android SDK 19 or later
	* (Optional) Genymotion

**Additional Software Requirements for Windows Phone On-Device Deployment**

> In this version of the `mobile-cli-lib`, you cannot deploy and LiveSync to connected Windows Phone devices from the command line.

#### OS X Systems

**Minimum Software Requirements**

* OS X Mavericks
* Node.js 0.10.26 or a later stable official release except 0.10.34<br/>A [known issue](http://docs.telerik.com/platform/appbuilder/troubleshooting/known-issues/known-issues-cli-and-sp#the-appbuilder-command-line-interface-and-appbuilder-package-for-sublime-text-27-have-introduced-the-following-known-issues) prevents the `mobile-cli-lib` from working properly with Node.js 0.10.34.
* Mono 3.12 or later

**Additional Software Requirements for iOS On-Device Deployment**

* iTunes (latest official)
* For testing in the native emulator
	* Xcode 5 or later

**Additional Software Requirements for Android On-Device Deployment**

* Device drivers required by your system to recognize the connected Android device
* For testing in the native emulators
	* JDK 8 or later
	* Android SDK 19 or later
	* (Optional) Genymotion

**Additional Software Requirements for Windows Phone On-Device Deployment**

> In this version of the `mobile-cli-lib`, you cannot deploy and LiveSync to connected Windows Phone devices from the command line.

#### Linux Systems

**Minimum Software Requirements** 

* Ubuntu 14.04 LTS<br/>The `mobile-cli-lib` is tested and verified to run on Ubuntu 14.04 LTS. You might be able to run the `mobile-cli-lib` on other Linux distributions.
* Node.js 0.10.26 or a later stable official release except 0.10.34<br/>A [known issue](http://docs.telerik.com/platform/appbuilder/troubleshooting/known-issues/known-issues-cli-and-sp#the-appbuilder-command-line-interface-and-appbuilder-package-for-sublime-text-27-have-introduced-the-following-known-issues) prevents the `mobile-cli-lib` from working properly with Node.js 0.10.34.

   > **TIP:** You can follow the instructions provided [here](https://github.com/joyent/node/wiki/Installing-Node.js-via-package-manager) to install Node.js on your system.

* An Internet browser (latest official release)
* (64-bit systems) The runtime libraries for the ia32/i386 architecture
   * In the terminal, run the following command.
      
      ```
      sudo apt-get install lib32z1 lib32ncurses5 lib32bz2-1.0 libstdc++6:i386
      ```

**Additional Software Requirements for iOS On-Device Deployment**

> In this version of the `mobile-cli-lib`, you cannot deploy and LiveSync on connected iOS devices from the command line. You need to manually deploy the application package using iTunes.

**Additional Software Requirements for Android On-Device Deployment**

* Device drivers required by your system to recognize the connected Android device
* G++ compiler
   * In the terminal, run `sudo apt-get install g++`
* For testing in the native emulators
	* JDK 8 or later
	* Android SDK 19 or later
	* (Optional) Genymotion

**Additional Software Requirements for Windows Phone On-Device Deployment**

> In this version of the `mobile-cli-lib`, you cannot deploy and LiveSync to connected Windows Phone devices from the command line.

### Install the mobile-cli-lib

The `mobile-cli-lib` should be added as dependency in your project's `package.json`.

Usage
==

In order to use mobile-cli-lib, just add a reference to it in your package.json:
```JSON
dependencies: {
	"mobile-cli-lib": "https://github.com/telerik/mobile-cli-lib/tarball/master"
}
```

After that execute `npm install` in the directory, where your `package.json` is located. This command will install all your dependencies in `node_modules` directory. Now you are ready to use `mobile-cli-lib` in your project:

```JavaScript
var common = require("mobile-cli-lib");
common.fs.getFileSize("D:\\Work\\t.txt")
    .then(function (result) {
        console.log("File size is: " + result);
        return result;
    }, function (err) {
        console.log("Error happened:");
        console.log(err);
    });
```

### Sample application

You can find a sample application [here](https://gist.github.com/rosen-vladimirov/f9d9919ba9a413679af7). Just download the zip file and execute `npm install` in the project directory.
After that you can execute `node index.js` in your terminal. In case you have file `D:\Work\t.txt`, the application will show you its size. In case you do not have such file, the application will show an error.
You can change the filename in `index.js`.

Public API
==

This section contains information about each public method. All methods return Promise.

### Module fs
> Stability: 0 - Only for testing purposes. Will be removed.

For testing purposes we have exposed fs module and one of its methods: getFileSize. Its signature is:
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
	}, function (err) {
    	console.log("Error happened:");
    	console.log(err);
	});
```

Technical details
==

### Injector
Similar to `AngularJS`, `mobile-cli-lib` is using `$injector` to retrive object instances, instantiate types and load modules. Each module must be registered in the `$injector`, so when another module depends on it, the `$injector` will create a new instance of the dependency or reuse already created one.

#### How to add new module
* Add a new file with kebab-case ([spinal-case](http://en.wikipedia.org/wiki/Letter_case#Special_case_styles)) name. For example when the class that you'll add is called `DeviceService`, it is good practice to call the file `device-service.ts`.

* Add your class in the file. The class name should be in <a href="https://msdn.microsoft.com/en-us/library/x2dbyw72(v=vs.71).aspx">Pascal case</a>

```TypeScript
///<reference path="../.d.ts"/>
"use strict";

class DeviceService {
}
```
> NOTE: The reference path at the top must point the the root of the project, where `.d.ts` file is created by `grunt`.

* Register the class in the injector with the name that all other modules will use when they want instance of the `DeviceService`. The name should be in <a href="https://msdn.microsoft.com/en-us/library/x2dbyw72(v=vs.71).aspx">Camel case</a>:
```TypeScript
class DeviceService {
}
$injector.register("deviceService", DeviceService);
```

* Add the methods you need in your implementation:
```TypeScript
class DeviceService {
	public listDevices(): void {
		// implementation is here
	}
}
$injector.register("deviceService", DeviceService);
```

* If your class depends on other modules, registered in the `$injector`, you can access them by adding them as parameters of the constructor:
```TypeScript
class DeviceService {
	constructor(private $fs: IFileSystem) { }
}
$injector.register("deviceService", DeviceService);
```

> NOTE: In case you do not place access modifier (`private`, `protected` or `public`, you'll be able to use the dependant module only in the constructor.

> NOTE: The name of the module must be exactly the same as the one used for registering in the `$injector`, in this case this is `fs` module. The preceding dollar symbol `$` is mandatory.
Now you can access `fs` methods by using `this.$fs.<method>`.

* The last step is to add your module to `bootstrap.ts`:
```TypeScript
$injector.require("deviceService", "./device-service");
```
This line tells the `$injector` to look for module called "deviceService" in a file `device-service` located at the root of the `mobile-cli-lib`.
> NOTE: The name of the module must be the same as the one used in `$injector.register` call.
`$injector.require` will not load the file. It will be loaded by `$injector` when someone asks for module "deviceService".

### How to make a method public
In order to expose public API, we use TypeScript decorators and some "magic" in our bootstrapping. When you want to expose method `B` from class `A`, you have to do the following:
* In `bootstrap.ts` make sure to use `requirePublic` method of the `$injector` when requiring the file:

```TypeScript
$injector.requirePublic("deviceService", "./device-service")
```

* Add the exported decorator on the method which you want to expose: `@decorators.exported('deviceService')`, where decorators are imported from the root of the project: `import decorators = require("./decorators");`

> IMPORTANT: `exported` decorator requires one parameter which MUST be the first parameter passed to `requirePublic` method. This is the name of the module that will be publicly exposed.

After you have executed these two steps, you can start using your publicly available method:

```JavaScript
var common = require("mobile-cli-lib");
common.deviceService.listDevices() /* NOTE: here we are not using the class name DeviceService, but the module name - deviceService */
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
`requirePublic` method of the `injector` is doing some "magic" in order to support lazy loading, correct dependency resolving and exposing only some of the methods, not the whole power of the common lib.
When you require `mobile-cli-lib` module, you receive $injector's publicApi - it is the "exported one". `requirePublic` method defines getter for each module that is passed, for example when you say:
```TypeScript
	$injector.requirePublic("deviceService", "./device-service")
```
a new property is added to publicApi - `deviceService` and a getter is added for it. When you try to access this module, `require("mobile-cli-lib").deviceService.listDevices()`, the getter is called. It resolves the module, by parsing the provided file (`./device-service`)
and that's the time when decorators are executed. For each decorated method, a new entry in `$injector.publicApi.__modules__` is created. This is not the same method that you've decorated - it's entirely new method, that returns a Promise.
The new method will be used in the publicApi, while original implementation will still be used in all other places in the code. The promisified method will call the original one (in a separate Fiber) and will resolve the Promise with the result of the method.


Issues
==

### Missing dependencies

Some of our modules must be added: staticConfig, config, analyticsService, etc.

### Tests for injector

Add more tests for yok and for register decorator.
