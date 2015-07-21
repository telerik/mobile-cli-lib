///<reference path="./../../../.d.ts"/>
"use strict";

import ref = require("ref");
import os = require("os");
import path = require("path");
import IOSDevice = require("./../ios/ios-device");
import AndroidDevice = require("./../android/android-device");
import CoreTypes = require("./../ios/ios-core");
import Signal = require("./../../events/signal");
import Future = require("fibers/future");
import child_process = require("child_process");
import helpers = require("./../../helpers");

export class DeviceDiscovery implements Mobile.IDeviceDiscovery {
	private devices: {[key: string]: Mobile.IDevice} = {};

	public deviceFound :ISignal= null;
	public deviceLost: ISignal = null;

	constructor() {
		this.deviceFound =  new Signal.Signal();
		this.deviceLost =  new Signal.Signal();
	}

	public addDevice(device: Mobile.IDevice) {
		this.devices[device.getIdentifier()] = device;
		this.raiseOnDeviceFound(device);
	}

	public removeDevice(deviceIdentifier: string) {
		let device = this.devices[deviceIdentifier];
		if(!device) {
			return;
		}
		delete this.devices[deviceIdentifier];
		this.raiseOnDeviceLost(device);
	}

	public startLookingForDevices(): IFuture<void> {
		return undefined;
	}

	private raiseOnDeviceFound(device: Mobile.IDevice) {
		this.deviceFound.dispatch(device);
	}

	private raiseOnDeviceLost(device: Mobile.IDevice) {
		this.deviceLost.dispatch(device);
	}
}
$injector.register("deviceDiscovery", DeviceDiscovery);

class IOSDeviceDiscovery extends DeviceDiscovery {
	private static ADNCI_MSG_CONNECTED = 1;
	private static ADNCI_MSG_DISCONNECTED = 2;
	private static APPLE_SERVICE_NOT_STARTED_ERROR_CODE = 0xE8000063;

	private timerCallbackPtr: NodeBuffer = null;
	private notificationCallbackPtr: NodeBuffer = null;

	constructor(private $coreFoundation: Mobile.ICoreFoundation,
		private $mobileDevice: Mobile.IMobileDevice,
		private $errors: IErrors,
		private $injector: IInjector,
		private $options: IOptions) {
		super();
		this.timerCallbackPtr = CoreTypes.CoreTypes.cf_run_loop_timer_callback.toPointer(IOSDeviceDiscovery.timerCallback);
		this.notificationCallbackPtr = CoreTypes.CoreTypes.am_device_notification_callback.toPointer(IOSDeviceDiscovery.deviceNotificationCallback);
	}

	public startLookingForDevices(): IFuture<void> {
		return (() => {
			this.subscribeForNotifications();
			let defaultTimeoutInSeconds = this.$options.timeout ? parseInt(this.$options.timeout, 10)/1000 : 1;
			this.startRunLoopWithTimer(defaultTimeoutInSeconds);
		}).future<void>()();
	}

	private static deviceNotificationCallback(devicePointer?: NodeBuffer, user?: number) : any {
		let iOSDeviceDiscovery = $injector.resolve("iOSDeviceDiscovery");
		let deviceInfo = ref.deref(devicePointer);

		if(deviceInfo.msg === IOSDeviceDiscovery.ADNCI_MSG_CONNECTED) {
			iOSDeviceDiscovery.createAndAddDevice(deviceInfo.dev);
		}
		else if(deviceInfo.msg === IOSDeviceDiscovery.ADNCI_MSG_DISCONNECTED) {
			let deviceIdentifier = iOSDeviceDiscovery.$coreFoundation.convertCFStringToCString(iOSDeviceDiscovery.$mobileDevice.deviceCopyDeviceIdentifier(deviceInfo.dev));
			iOSDeviceDiscovery.removeDevice(deviceIdentifier);
		}
	}

	private static timerCallback(): void {
		let iOSDeviceDiscovery = $injector.resolve("iOSDeviceDiscovery");
		iOSDeviceDiscovery.$coreFoundation.runLoopStop(iOSDeviceDiscovery.$coreFoundation.runLoopGetCurrent());
	}

	private validateResult(result: number, error: string) {
		if(result !== 0)  {
			this.$errors.fail(error);
		}
	}

	private subscribeForNotifications() {
		let notifyFunction = ref.alloc(CoreTypes.CoreTypes.amDeviceNotificationRef);

		let result = this.$mobileDevice.deviceNotificationSubscribe(this.notificationCallbackPtr, 0, 0, 0, notifyFunction);
		let error = IOSDeviceDiscovery.APPLE_SERVICE_NOT_STARTED_ERROR_CODE ?
			"Cannot run and complete operations on iOS devices because Apple Mobile Device Service is not started. Verify that iTunes is installed and running on your system." : "Unable to subscribe for notifications";
		this.validateResult(result, error);
		this.$errors.verifyHeap("subscribeForNotifications");
	}

	private startRunLoopWithTimer(timeout: number): void {
		let kCFRunLoopDefaultMode = this.$coreFoundation.kCFRunLoopDefaultMode();
		let timer: NodeBuffer = null;

		if(timeout > 0) {
			let currentTime = this.$coreFoundation.absoluteTimeGetCurrent() + timeout;
			timer = this.$coreFoundation.runLoopTimerCreate(null, currentTime , 0, 0, 0, this.timerCallbackPtr, null);
			this.$coreFoundation.runLoopAddTimer(this.$coreFoundation.runLoopGetCurrent(), timer, kCFRunLoopDefaultMode);
		}

		this.$coreFoundation.runLoopRun();

		if(timeout > 0) {
			this.$coreFoundation.runLoopRemoveTimer(this.$coreFoundation.runLoopGetCurrent(), timer, kCFRunLoopDefaultMode);
		}

		this.$errors.verifyHeap("startRunLoopWithTimer");
	}

	private createAndAddDevice(devicePointer: NodeBuffer): void {
		let device = this.$injector.resolve(IOSDevice.IOSDevice, {devicePointer: devicePointer});
		this.addDevice(device);
	}
}

class IOSDeviceDiscoveryStub extends DeviceDiscovery {
	constructor(private $logger: ILogger,
		private $staticConfig: Config.IStaticConfig,
		private $hostInfo: IHostInfo,
		private error: string) {
		super();
	}

	public startLookingForDevices(): IFuture<void> {
		if(this.error) {
			this.$logger.warn(this.error);
		} else if(this.$hostInfo.isLinux) {
			this.$logger.warn("In this version of the %s command-line interface, you cannot use connected iOS devices.", this.$staticConfig.CLIENT_NAME.toLowerCase());
		}
		
		return Future.fromResult();
	}
}

$injector.register("iOSDeviceDiscovery", ($errors: IErrors, $logger: ILogger, $fs: IFileSystem, $injector: IInjector, $iTunesValidator: Mobile.IiTunesValidator, $staticConfig: Config.IStaticConfig, $hostInfo: IHostInfo) => {
	let error = $iTunesValidator.getError().wait();
	let result: Mobile.IDeviceDiscovery = null;

	if(error || $hostInfo.isLinux) {
		result = new IOSDeviceDiscoveryStub($logger, $staticConfig, $hostInfo, error);
	} else {
		result = $injector.resolve(IOSDeviceDiscovery);
	}

	return result;
});

export class AndroidDeviceDiscovery extends DeviceDiscovery {
	private static adb: string;

	constructor(private $childProcess: IChildProcess,
		private $injector: IInjector,
		private $staticConfig: Config.IStaticConfig){
		super();
	}

	private get Adb() {
		if(!AndroidDeviceDiscovery.adb) {
			AndroidDeviceDiscovery.adb = helpers.getPathToAdb($injector).wait();
		}

		return AndroidDeviceDiscovery.adb;
	}

	private createAndAddDevice(deviceIdentifier: string): IFuture<void> {
		return (() => {
			let device = this.$injector.resolve(AndroidDevice.AndroidDevice, {
					identifier: deviceIdentifier, adb: this.Adb
				});
			this.addDevice(device);
		}).future<void>()();
	}

	public startLookingForDevices(): IFuture<void> {
		return(()=> {
			this.ensureAdbServerStarted().wait();

			let requestAllDevicesCommand = `"${this.Adb}" devices`;
			let result = this.$childProcess.exec(requestAllDevicesCommand).wait();

			let devices = result.toString().split(os.EOL).slice(1)
				.filter( (element:string) => !helpers.isNullOrWhitespace(element) )
				.map((element: string) => {
					// http://developer.android.com/tools/help/adb.html#devicestatus
					let parts = element.split("\t");
					let identifier = parts[0];
					let state = parts[1];
					if (state === "device"/*ready*/) {
						this.createAndAddDevice(identifier).wait();
					}
				});
		}).future<void>()();
	}

	private ensureAdbServerStarted(): IFuture<void> {
		let startAdbServerCommand =`"${this.Adb}" start-server`;
		return this.$childProcess.exec(startAdbServerCommand);
	}
}
$injector.register("androidDeviceDiscovery", AndroidDeviceDiscovery);

