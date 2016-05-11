///<reference path="./../../.d.ts"/>
"use strict";

import * as util from "util";
import * as constants from "../constants";
import {EOL} from "os";
import * as androidDebugBridgePath from "../android/android-debug-bridge";

export class AndroidProcessService implements Mobile.IAndroidProcessService {
	// Describes one row from the adb shell cat proc/net/tcp result.
	private static ANDROID_PORT_INFORMATION_REGEX = /([0-9]+):\W+([0-9A-Za-z]+:[0-9A-Za-z]+)\W+([0-9A-Za-z]+:[0-9A-Za-z]+)\W+([0-9A-Za-z]+)\W+[0-9A-Za-z]+:[0-9A-Za-z]+\W+[0-9A-Za-z]+:[0-9A-Za-z]+ +[0-9A-Za-z]+\W+([0-9]+)/g;
	constructor(private $errors: IErrors,
		private $staticConfig: Config.IStaticConfig,
		private $injector: IInjector) { }

	public mapAbstractToTcpPort(deviceIdentifier: string, appIdentifier: string): IFuture<string> {
		return (() => {
			let adb: Mobile.IAndroidDebugBridge = this.$injector.resolve(androidDebugBridgePath.AndroidDebugBridge, { identifier: deviceIdentifier });
			let processId = this.getProcessId(adb, appIdentifier).wait();
			if (!processId) {
				this.$errors.failWithoutHelp(`The application is not installed on the device with identifier ${deviceIdentifier}.`);
			}

			let abstractPort = this.getAbstractPortForApplication(adb, processId, appIdentifier).wait();

			if (!abstractPort) {
				this.$errors.failWithoutHelp(`The application is not started on the device with identifier ${deviceIdentifier}.`);
			}

			// Get the available ports information as late as possible.
			let availablePorts: Mobile.IAndroidPortInformation[] = this.getAvailableAndroidPortsInformation(adb, appIdentifier).wait();
			if (!availablePorts || availablePorts.length === 0) {
				this.$errors.failWithoutHelp("There are no available ports.");
			}

			let realPort = availablePorts[0];

			adb.executeCommand(["forward", `tcp:${realPort.number}`, `localabstract:${abstractPort}`]).wait();

			return realPort.number;
		}).future<string>()();
	}

	private getAbstractPortForApplication(adb: Mobile.IAndroidDebugBridge, processId: string, appIdentifier: string): IFuture<string> {
		return (() => {
			// The result will look like this (without the columns names):
			// Num       		 RefCount Protocol Flags    Type St Inode  Path
			// 0000000000000000: 00000002 00000000 00010000 0001 01 189004 @webview_devtools_remote_25512
			// The Path column is the abstract port.
			let abstractPortRegex = /\w+:\W+(\w+[ \t]+){1,6}/;

			// Need to search by processId to check for old Android webviews (@webview_devtools_remote_<processId>).
			let androidWebViewPortInformation = adb.executeShellCommand(["cat", "proc/net/unix", "|grep", "-a", "--text", processId]).wait();
			// Search for appIdentifier (@<appIdentifier>_devtools_remote).
			let chromeWebViewPortInformation = adb.executeShellCommand(["cat", "proc/net/unix", "|grep", "-a", "--text", appIdentifier + "_devtools_remote"]).wait();
			// Search for appIdentifier (@<appIdentifier-debug>).
			let nativeScriptWebViewPortInformation = adb.executeShellCommand(["cat", "proc/net/unix", "|grep", "-a", "--text", `${appIdentifier}-debug`]).wait();

			// Need to check for
			let abstractPortInformation: string = androidWebViewPortInformation || chromeWebViewPortInformation || nativeScriptWebViewPortInformation;

			if (!abstractPortInformation.match(abstractPortRegex)) {
				return null;
			}

			// Need to take the third element from the array because after the split the array will conatin ['', '<Match from the regex group>', '<AbstractPort>'].
			// Abstract port will be in format @<AbstractPort> and need to remove the "@" character.
			return abstractPortInformation.split(abstractPortRegex)[2].trim().substr(1);
		}).future<string>()();
	}

	private getProcessId(adb: Mobile.IAndroidDebugBridge, appIdentifier: string): IFuture<string> {
		return (() => {
			// Process information will look like this (without the columns names):
			// USER     PID   PPID  VSIZE   RSS   WCHAN    PC         NAME
			// u0_a63   25512 1334  1519560 96040 ffffffff f76a8f75 S com.telerik.appbuildertabstest
			let processIdRegex = /^\w*\W*([0-9]+)/;
			let processIdInformation: string = adb.executeShellCommand(["ps", "|grep", "-a", "--text", appIdentifier]).wait();

			let matches = processIdRegex.exec(processIdInformation);

			if (!matches || !matches[0]) {
				return null;
			}

			return matches[1];
		}).future<string>()();
	}

	private getAvailableAndroidPortsInformation(adb: Mobile.IAndroidDebugBridge, appIdentifier: string): IFuture<Mobile.IAndroidPortInformation[]> {
		return (() => {
			// The result of adb shell dumpsys package package.name |grep userId= looks like:
			// userId=10060 gids=[1028, 1015, 3003]
			let userIdRegex = /userId=([0-9]+)/;
			let packageDumpSysInformation = adb.executeShellCommand(["dumpsys", "package", appIdentifier, "|grep", "-a", "--text", "userId="]).wait();

			let applicationUid = parseInt(userIdRegex.exec(packageDumpSysInformation)[1]);

			// Get ports information.
			// Result will look like this:
			// sl local_address rem_address   st tx_queue rx_queue tr tm->when retrnsmt  uid  timeout inode
			// 0: 0100007F:1C23 00000000:0000 0A 00000000:00000000 00:00000000 00000000  1001       0 2111 1 e22cc000 300 0 0 2 -1
			let tcpPorts: string[] = adb.executeShellCommand(["cat", "proc/net/tcp"]).wait().split(EOL);
			let tcp6Ports: string[] = adb.executeShellCommand(["cat", "proc/net/tcp6"]).wait().split(EOL);

			let allPorts: string[] = tcpPorts.concat(tcp6Ports);

			// Get information only for the ports which are not in use - remote address is empty (only zeroes) and have host localhost.
			let emptyAddressRegex = /^00*:0+/;

			// Localhost hex representation is 0100007F or 0000000000000000FFFF00000100007F
			let localHostHexRegex = /^00*100007F/;
			let localHostVersionSixHexRegex = /^00*FFFF00000100007F/;
			let availablePorts: Mobile.IAndroidPortInformation[] = _(allPorts)
				.filter((line: string) => line.match(AndroidProcessService.ANDROID_PORT_INFORMATION_REGEX))
				.map(this.parseAndroidPortInformation)
				.filter((port: Mobile.IAndroidPortInformation) => port.remAddress.match(emptyAddressRegex) && (port.ipAddressHex.match(localHostHexRegex) || port.ipAddressHex.match(localHostVersionSixHexRegex)))
				.value();

			return availablePorts;
		}).future<Mobile.IAndroidPortInformation[]>()();
	}

	private parseAndroidPortInformation(portInformationRow: string): Mobile.IAndroidPortInformation {
		let matches = AndroidProcessService.ANDROID_PORT_INFORMATION_REGEX.exec(portInformationRow);
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
			sl: matches[1],
			localAddress: localAddress,
			remAddress: matches[3],
			st: matches[4],
			uid: parseInt(matches[5]),
			ipAddressHex: hexIpAddress,
			number: parseInt(hexPort, 16),
			numberHex: hexPort
		};

		return portInformation;
	}
}

$injector.register("androidProcessService", AndroidProcessService);
