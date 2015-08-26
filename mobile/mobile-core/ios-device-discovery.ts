///<reference path="./../../.d.ts"/>
"use strict";

import {DeviceDiscovery} from "./device-discovery"
import {CoreTypes} from "../ios/ios-core";
import * as ref from "ref";
import {IOSDevice} from "../ios/ios-device";
import Future = require("fibers/future");

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
		private $options: ICommonOptions,
		private $utils: IUtils) {
		super();
		this.timerCallbackPtr = CoreTypes.cf_run_loop_timer_callback.toPointer(IOSDeviceDiscovery.timerCallback);
		this.notificationCallbackPtr = CoreTypes.am_device_notification_callback.toPointer(IOSDeviceDiscovery.deviceNotificationCallback);
	}

	public startLookingForDevices(): IFuture<void> {
		return (() => {
			this.subscribeForNotifications();
			let defaultTimeoutInSeconds = 1;
			let parsedTimeout =  this.$utils.getParsedTimeout(1);
			let timeout = parsedTimeout > defaultTimeoutInSeconds ? parsedTimeout/1000 : defaultTimeoutInSeconds;
			this.startRunLoopWithTimer(timeout);
			setInterval(() => this.startRunLoopWithTimer(timeout), 1000); // I think we should unref this as it will block CLI's execution and will hold the console.
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
		let notifyFunction = ref.alloc(CoreTypes.amDeviceNotificationRef);

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
		let device = this.$injector.resolve(IOSDevice, {devicePointer: devicePointer});
		this.addDevice(device);
	}
}
$injector.register("iOSDeviceDiscovery", IOSDeviceDiscovery);

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

