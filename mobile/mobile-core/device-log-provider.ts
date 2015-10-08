///<reference path="./../../.d.ts"/>
"use strict";

import { EventEmitter } from "events";
import byline = require("byline");
import fiberBootstrap = require("../../fiber-bootstrap");

export class DeviceLogProvider extends EventEmitter implements Mobile.IDeviceLogProvider {
	public logData(line: string, deviceIdentifier?: string): void {
		this.emit('data', deviceIdentifier, line);
	}
}
$injector.register("deviceLogProvider", DeviceLogProvider);
