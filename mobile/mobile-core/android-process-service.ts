///<reference path="./../../.d.ts"/>
"use strict";

import {EOL} from "os";
import {DeviceAndroidDebugBridge} from "../android/device-android-debug-bridge";

export class AndroidProcessService implements Mobile.IAndroidProcessService {
	private _devicesAdbs: IDictionary<Mobile.IDeviceAndroidDebugBridge>;

	constructor(private $errors: IErrors,
		private $staticConfig: Config.IStaticConfig,
		private $injector: IInjector) {
		this._devicesAdbs = {};
	}

	private get androidPortInformationRegExp(): RegExp {
		// The RegExp should look like this:
		// /(\d+):\s+([0-9A-Za-z]+:[0-9A-Za-z]+)\s+([0-9A-Za-z]+:[0-9A-Za-z]+)\s+[0-9A-Za-z]+\s+[0-9A-Za-z]+:[0-9A-Za-z]+\s+[0-9A-Za-z]+:[0-9A-Za-z]+\s+[0-9A-Za-z]+\s+(\d+)/g
		let wordCharacters = "[0-9A-Za-z]+";
		let hexIpAddressWithPort = "[0-9A-Za-z]+:[0-9A-Za-z]+";
		let hexIpAddressWithPortWithSpace = `${hexIpAddressWithPort}\\s+`;
		let hexIpAddressWithPortWithSpaceMatch = `(${hexIpAddressWithPort})\\s+`;

		return new RegExp(`(\\d+):\\s+${hexIpAddressWithPortWithSpaceMatch}${hexIpAddressWithPortWithSpaceMatch}${wordCharacters}\\s+${hexIpAddressWithPortWithSpace}${hexIpAddressWithPortWithSpace}${wordCharacters}\\s+(\\d+)`, "g");
	}

	public mapAbstractToTcpPort(deviceIdentifier: string, appIdentifier: string): IFuture<string> {
		return (() => {
			let adb = this.getAdb(deviceIdentifier);
			let processId = this.getProcessId(adb, appIdentifier).wait();
			let applicationNotStartedErrorMessage = `The application is not started on the device with identifier ${deviceIdentifier}.`;

			if (!processId) {
				this.$errors.failWithoutHelp(applicationNotStartedErrorMessage);
			}

			let abstractPort = this.getAbstractPortForApplication(adb, processId, appIdentifier).wait();

			if (!abstractPort) {
				this.$errors.failWithoutHelp(applicationNotStartedErrorMessage);
			}

			// Get the available ports information as late as possible.
			let availablePorts: Mobile.IAndroidPortInformation[] = this.getAvailableAndroidPortsInformation(adb, appIdentifier).wait();
			if (!availablePorts || !availablePorts.length) {
				this.$errors.failWithoutHelp("There are no available ports.");
			}

			let realPort = availablePorts[0];

			adb.executeCommand(["forward", `tcp:${realPort.number}`, `localabstract:${abstractPort}`]).wait();

			return realPort.number;
		}).future<string>()();
	}

	public getDebuggableApps(deviceIdentifier: string): IFuture<string[]> {
		return (() => {
			let adb = this.getAdb(deviceIdentifier);
			let androidWebViewPortInformation = (<string>this.getAbstractPortsInformation(adb).wait()).split(EOL);

			return androidWebViewPortInformation
				.map((line: string) => this.getApplicationNameFromWebViewPortInformation(adb, line).wait())
				.filter((appIdentifier: string) => !!appIdentifier);
		}).future<string[]>()();
	}

	private getApplicationNameFromWebViewPortInformation(adb: Mobile.IDeviceAndroidDebugBridge, information: string): IFuture<string> {
		return (() => {
			// Need to search by processId to check for old Android webviews (@webview_devtools_remote_<processId>).
			let processIdRegExp = /@webview_devtools_remote_(.+)/g;
			let processIdMatches = processIdRegExp.exec(information);
			if (processIdMatches) {
				let processId = processIdMatches[1];
				// Process information will look like this (without the columns names):
				// USER     PID   PPID  VSIZE   RSS   WCHAN    PC         NAME
				// u0_a63   25512 1334  1519560 96040 ffffffff f76a8f75 S com.telerik.appbuildertabstest
				let processIdInformation: string = adb.executeShellCommand(["ps", "|grep", processId]).wait();

				return _.last(processIdInformation.trim().split(/[ \t]/));
			}

			// Search for appIdentifier (@<appIdentifier>_devtools_remote).
			let chromeAppIdentifierRegExp = /@(.+)_devtools_remote\s?/g;

			// Search for appIdentifier (@<appIdentifier-debug>).
			let nativeScriptAppIdentifierRegExp = /@(.+)-debug/g;

			let chromeAppIdentifierMatches = chromeAppIdentifierRegExp.exec(information);
			let nativeScriptAppIdentifierMatches = nativeScriptAppIdentifierRegExp.exec(information);

			return (chromeAppIdentifierMatches && chromeAppIdentifierMatches[1]) || (nativeScriptAppIdentifierMatches && nativeScriptAppIdentifierMatches[1]);
		}).future<string>()();
	}

	private getAbstractPortForApplication(adb: Mobile.IDeviceAndroidDebugBridge, processId: string, appIdentifier: string): IFuture<string> {
		return (() => {
			// The result will look like this (without the columns names):
			// Num       		 RefCount Protocol Flags    Type St Inode  Path
			// 0000000000000000: 00000002 00000000 00010000 0001 01 189004 @webview_devtools_remote_25512
			// The Path column is the abstract port.
			let abstractPortsInformation = this.getAbstractPortsInformation(adb).wait();
			return this.getPortInformation(abstractPortsInformation, processId) ||
				this.getPortInformation(abstractPortsInformation, `${appIdentifier}_devtools_remote`) ||
				this.getPortInformation(abstractPortsInformation, `${appIdentifier}-debug`);
		}).future<string>()();
	}

	private getAbstractPortsInformation(adb: Mobile.IDeviceAndroidDebugBridge): IFuture<string> {
		return adb.executeShellCommand(["cat", "/proc/net/unix"]);
	}

	private getPortInformation(abstractPortsInformation: string, searchedInfo: string): string {
		let processRegExp = new RegExp(`\\w+:\\s+(?:\\w+\\s+){1,6}@(.*?${searchedInfo})$`, "gm");

		let match = processRegExp.exec(abstractPortsInformation);
		return match && match[1];
	}

	private getProcessId(adb: Mobile.IDeviceAndroidDebugBridge, appIdentifier: string): IFuture<string> {
		return (() => {
			// Process information will look like this (without the columns names):
			// USER     PID   PPID  VSIZE   RSS   WCHAN    PC         NAME
			// u0_a63   25512 1334  1519560 96040 ffffffff f76a8f75 S com.telerik.appbuildertabstest
			let processIdRegExp = /^\w*\s*(\d+)/;
			let processIdInformation: string = adb.executeShellCommand(["ps", "|grep", appIdentifier]).wait();

			let matches = processIdRegExp.exec(processIdInformation);

			if (!matches || !matches[0]) {
				return null;
			}

			return matches[1];
		}).future<string>()();
	}

	private getAvailableAndroidPortsInformation(adb: Mobile.IDeviceAndroidDebugBridge, appIdentifier: string): IFuture<Mobile.IAndroidPortInformation[]> {
		return (() => {
			// Get ports information.
			// Result will look like this:
			// sl local_address rem_address   st tx_queue rx_queue tr tm->when retrnsmt  uid  timeout inode
			// 0: 0100007F:1C23 00000000:0000 0A 00000000:00000000 00:00000000 00000000  1001       0 2111 1 e22cc000 300 0 0 2 -1
			let tcpPorts: string[] = adb.executeShellCommand(["cat", "proc/net/tcp"]).wait().split(EOL);
			let tcp6Ports: string[] = adb.executeShellCommand(["cat", "proc/net/tcp6"]).wait().split(EOL);

			let allPorts: string[] = tcpPorts.concat(tcp6Ports);

			// Get information only for the ports which are not in use - remote address is empty (only zeroes) and have host localhost.
			let emptyAddressRegExp = /^00*/;

			// Localhost hex representation is 0100007F or 0000000000000000FFFF00000100007F
			let localHostHexRegExp = /^00*100007F/;
			let localHostVersionSixHexRegExp = /^00*FFFF00000100007F/;
			let availablePorts: Mobile.IAndroidPortInformation[] = _(allPorts)
				.filter((line: string) => line.match(this.androidPortInformationRegExp))
				.map((line: string) => this.parseAndroidPortInformation(line))
				.filter((port: Mobile.IAndroidPortInformation) => {
					return port.remAddress.match(emptyAddressRegExp) &&
						(port.ipAddressHex.match(localHostHexRegExp) ||
							port.ipAddressHex.match(localHostVersionSixHexRegExp) ||
							port.ipAddressHex.match(emptyAddressRegExp));
				})
				.value();

			return availablePorts;
		}).future<Mobile.IAndroidPortInformation[]>()();
	}

	private parseAndroidPortInformation(portInformationRow: string): Mobile.IAndroidPortInformation {
		let matches = this.androidPortInformationRegExp.exec(portInformationRow);
		if (!matches || !matches[0]) {
			// The input information does not match the regex.
			return null;
		}

		// The local address will look like this IP_address:port both in hex format.
		let localAddress = matches[2];
		let localAddressParts = localAddress.split(":");

		let hexIpAddress = localAddressParts[0];
		let hexPort = localAddressParts[1];

		// The first match is the whole row.
		let portInformation: Mobile.IAndroidPortInformation = {
			localAddress: localAddress,
			remAddress: matches[3],
			uid: parseInt(matches[4]),
			ipAddressHex: hexIpAddress,
			number: parseInt(hexPort, 16),
			numberHex: hexPort
		};

		return portInformation;
	}

	private getAdb(deviceIdentifier: string): Mobile.IDeviceAndroidDebugBridge {
		if (!this._devicesAdbs[deviceIdentifier]) {
			this._devicesAdbs[deviceIdentifier] = this.$injector.resolve(DeviceAndroidDebugBridge, { identifier: deviceIdentifier });
		}

		return this._devicesAdbs[deviceIdentifier];
	}
}

$injector.register("androidProcessService", AndroidProcessService);
