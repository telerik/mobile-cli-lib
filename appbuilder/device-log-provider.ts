///<reference path="../.d.ts"/>
"use strict";

import { EventEmitter } from "events";

export class DeviceLogProvider extends EventEmitter implements Mobile.IDeviceLogProvider {
	public logData(line: string, platform: string, deviceIdentifier?: string): void {
		this.emit('data', deviceIdentifier, line);
	}
}
$injector.register("deviceLogProvider", DeviceLogProvider);
