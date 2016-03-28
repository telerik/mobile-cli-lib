mobile-cli-lib
==============

Provides an easy way for working with devices.
Contains common infrastructure for CLIs - mainly AppBuilder and NativeScript.

Installation
===

Latest version: 0.5.0

Release date: 2016, March 28

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
	"mobile-cli-lib": "0.4.0"
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

This section contains information about each public method.

Device related public API, exposes `IDeviceInfo` data, that contains the following information:
```TypeScript
/**
 * Describes available information for a device.
 */
interface IDeviceInfo {
	/**
	 * Unique identifier of the device.
	 */
	identifier: string;

	/**
	 * The name of the device.
	 * For Android this is the value of device's 'ro.product.name' property.
	 * For iOS this is the value of device's 'DeviceName' property.
	 */
	displayName: string;

	/**
	 * Device model.
	 * For Android this is the value of device's 'ro.product.model' property.
	 * For iOS this is the value of device's 'ProductType' property.
	 */
	model: string;

	/**
	 * Version of the OS.
	 * For Android this is the value of device's 'ro.build.version.release' property.
	 * For iOS this is the value of device's 'ProductVersion' property.
	 */
	version: string;

	/**
	 * Vendor of the device.
	 * For Android this is the value of device's 'ro.product.brand' property.
	 * For iOS the value is always "Apple".
	 */
	vendor: string;

	/**
	 * Device's platform.
	 * Can be Android or iOS.
	 */
	platform: string;

	/**
	 * Status of device describing if you can work with this device or there's communication error.
	 * Can be Connected or Unreachable.
	 */
	status: string;

	/**
	 * Additional information for errors that prevents working with this device.
	 * It will be null when status is Connected.
	 */
	errorHelp: string;

	/**
	 * Defines if the device is tablet or not.
	 * For Android the value will be true when device's 'ro.build.characteristics' property contains "tablet" word or when the 'ro.build.version.release' is 3.x
	 * For iOS the value will be true when device's 'ProductType' property contains "ipad" word.
	 */
	isTablet: boolean;

	/**
	 * Optional property describing the color of the device.
	 * Available for iOS only - the value of device's 'DeviceColor' property.
	 */
	color?: string;
}
```

### Module deviceEmitter
> Stability 2 - Stable

`deviceEmitter` module is used to emit different events related to devices attached to the system.
You can use `deviceEmitter` to add handles for the following events:

* `deviceFound` - Raised when a new device is attached to the system. The callback function will receive one argument - deviceInfoData.
Sample usage:
```JavaScript
require("mobile-cli-lib").deviceEmitter.on("deviceFound",  function(deviceInfoData) {
	console.log("Found device with identifier: " + deviceInfoData.identifier);
});
```

* `deviceLost` - Raised when a device is detached from the system. The callback function will receive one argument - deviceInfoData.
Sample usage:
```JavaScript
require("mobile-cli-lib").deviceEmitter.on("deviceLost",  function(deviceInfoData) {
	console.log("Detached device with identifier: " + deviceInfoData.identifier);
});
```

* `deviceLogData` - Raised when attached device sends reports any information. This is the output of `adb logcat` for Android devices. For iOS this is the `iOS SysLog`.
The event is raised for any device that reports data. The callback function has two arguments - `deviceIdentifier` and `reportedData`. <br/><br/>
Sample usage:
```JavaScript
require("mobile-cli-lib").deviceEmitter.on("deviceLogData",  function(identifier, reportedData) {
	console.log("Device " + identifier + " reports: " + reportedData);
});
```

### Module devicesService
> Stability: 2 - Stable

This module allows interaction with devices. You can get a list of the attached devices or deploy on specific devices.

* `getDevices()` - This function returns array of all connected devices. For each of them the following information is provided:
Sample usage:
```JavaScript
var devices = require("mobile-cli-lib").devicesService.getDevices();
devices.forEach(function(device) {
	console.log("Device " + device.identifier + " is connected.");
});
```

* `deployOnDevices(deviceIdentifiers: string[], packageFile: string, packageName: string)` - Deploys the specified package to the specified devices.
Returns array of Promises. Each of them will be rejected in case the file cannot be deployed on the device or in case there's no device with such identifier.
The function accepts three arguments:
	* `deviceIdentifiers` - array of the unique identifiers of the devices where the application will be deployed.
	* `packageFile` - path to the specified package (`.apk` or `.ipa`);
	* `packageName` - the identifier of the package. This corresponds to appId from `.abproject`.

Sample usage:
```JavaScript
Promise.all(require("mobile-cli-lib")
				.devicesService
				.deployOnDevices(["129604ab96a4d0053023b4bf5b288cf34a9ed5fa", "153544fa45f4a5646543b5bf1b221fe31a8fa6bc"], "./app.ipa", "com.telerik.testApp"))
			.then(function(data) {
				console.log(data);
			}, function(err) {
				console.log(err);
			});
```

* `setLogLevel(logLevel: string, deviceIdentifier?: string)` - Sets the logging level for device(s) to `INFO` or `FULL`.
The method has two parameters, only the first one is mandatory. When only `logLevel` is passed, it's value is used for all currently connected devices and all devices that will be connected in the future.
By default the logging level is set to `INFO`. For example when there are two devices attached and this method is called in the following way:
```JavaScript
require("mobile-cli-lib").devicesService.setLogLevel("FULL");
```
Everything that the devices report will be raised in `deviceEmitter.deviceLogData` event. When a new device is attached, all of the information that it reports will also be send.
When the `deviceIdentifier` is passed, the value of the log level will be used only for this device. For example when all devices report all of their logs (`FULL`) level, you may call:
```JavaScript
require("mobile-cli-lib").devicesService.setLogLevel("INFO", "129604ab96a4d0053023b4bf5b288cf34a9ed5fa");
```
This will set the logging level to `INFO` only for device with identifier `129604ab96a4d0053023b4bf5b288cf34a9ed5fa`.


* `isAppInstalledOnDevices(deviceIdentifiers: string[], appIdentifier: string)` - checks if the specified application is installed on each of the specified devices.
Sample usage:
```JavaScript
Promise.all(require("mobile-cli-lib")
				.devicesService
				.isAppInstalledOnDevices(devicesFound, "com.telerik.myApp"))
		.then(function(data) {
			console.log(data);
		}, function(err) {
			console.log(err);
		});
```
Result will be `[ false, false ]` for example.

### Module liveSyncService
> Stability: 1 - Could be changed due to some new requirments.

This module allows LiveSync applications on different devices.

* `livesync(devicesInfo: IDeviceLiveSyncInfo[], projectDir: string, filePaths?: string[])` - LiveSync changes on the specified devices.
In case filePaths are not specified, the whole project directory will be synced.
The `devicesInfo` array describes livesync operations for each device. Each object should be described with the following properties:
```TypeScript
/**
 * Describes device's LiveSync information.
 */
interface IDeviceLiveSyncInfo {
	/**
	 * Unique identifier of the device.
	 */
	deviceIdentifier: string;

	/**
	 * Defines if changes have to be synced to installed application.
	 */
	syncToApp: boolean;

	/**
	 * Defines if changes have to be synced to companion app.
	 */
	syncToCompanion: boolean;
}
```

Sample usage:
```JavaScript
var deviceInfos = [{"deviceIdentifier": "129604ab96a4d0053023b4bf5b288cf34a9ed5fa", "syncToApp": true, "syncToCompanion": false},
					{"deviceIdentifier": "153544fa45f4a5646543b5bf1b221fe31a8fa6bc", "syncToApp": true, "syncToCompanion": false}];
// Full Sync - the whole project dir will be synced
require("mobile-cli-lib").liveSyncService.livesync(deviceInfos, projectDir)
				.then(function(result) {
						console.log("Finished with full sync, result is: ", result);
				}).catch(function(err) {
						console.log("Error while livesyncing: ", err);
				});

// Or use livesync only for some files:
var filesToSync = [path.join(projectDir,"app","components", "homeView", "homeView.xml"),
					path.join(projectDir,"app","components", "addressView", "addressView.xml")]
require("mobile-cli-lib").liveSyncService.livesync(deviceInfos, projectDir, filesToSync)
				.then(function(result) {
						console.log("Finished with partial sync, result is: ", result);
				}).catch(function(err) {
						console.log("Error while livesyncing: ", err);
				});
```

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
