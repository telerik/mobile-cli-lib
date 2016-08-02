import {EOL} from "os";
import * as shelljs from "shelljs";
import {DeviceAndroidDebugBridge} from "../android/device-android-debug-bridge";
import {TARGET_FRAMEWORK_IDENTIFIERS} from "../../constants";
import {attachToProcessExitSignals} from "../../helpers";

export class AndroidProcessService implements Mobile.IAndroidProcessService {
	private _shouldAddProcessExitEventListeners: boolean;
	private _devicesAdbs: IDictionary<Mobile.IDeviceAndroidDebugBridge>;
	private _forwardedLocalPorts: number[];

	constructor(private $errors: IErrors,
		private $staticConfig: Config.IStaticConfig,
		private $injector: IInjector,
		private $net: INet) {
		this._devicesAdbs = {};
		this._shouldAddProcessExitEventListeners = true;
		this._forwardedLocalPorts = [];
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

	public mapAbstractToTcpPort(deviceIdentifier: string, appIdentifier: string, framework: string): IFuture<string> {
		return (() => {
			this.tryAttachToProcessExitSignals();

			let adb = this.getAdb(deviceIdentifier);
			let processId = this.getProcessIds(adb, [appIdentifier]).wait()[appIdentifier];
			let applicationNotStartedErrorMessage = `The application is not started on the device with identifier ${deviceIdentifier}.`;

			if (!processId) {
				this.$errors.failWithoutHelp(applicationNotStartedErrorMessage);
			}

			let abstractPortsInformation = this.getAbstractPortsInformation(adb).wait();
			let abstractPort = this.getAbstractPortForApplication(adb, processId, appIdentifier, abstractPortsInformation, framework).wait();

			if (!abstractPort) {
				this.$errors.failWithoutHelp(applicationNotStartedErrorMessage);
			}

			let localPort = this.getAlreadyMappedPort(adb, deviceIdentifier, abstractPort).wait();

			if (!localPort) {
				localPort = this.$net.getFreePort().wait();
				adb.executeCommand(["forward", `tcp:${localPort}`, `localabstract:${abstractPort}`]).wait();
			}

			this._forwardedLocalPorts.push(localPort);
			return localPort;
		}).future<string>()();
	}

	public getMappedAbstractToTcpPorts(deviceIdentifier: string, appIdentifiers: string[], framework: string): IFuture<IDictionary<number>> {
		return ((): IDictionary<number> => {
			let adb = this.getAdb(deviceIdentifier),
				abstractPortsInformation = this.getAbstractPortsInformation(adb).wait(),
				processIds = this.getProcessIds(adb, appIdentifiers).wait(),
				adbForwardList = adb.executeCommand(["forward", "--list"]).wait(),
				localPorts: IDictionary<number> = {};

			_.each(appIdentifiers, appIdentifier => {
				localPorts[appIdentifier] = null;
				let processId = processIds[appIdentifier];

				if (!processId) {
					return;
				}

				let abstractPort = this.getAbstractPortForApplication(adb, processId, appIdentifier, abstractPortsInformation, framework).wait();

				if (!abstractPort) {
					return;
				}

				let localPort = this.getAlreadyMappedPort(adb, deviceIdentifier, abstractPort, adbForwardList).wait();

				if (localPort) {
					localPorts[appIdentifier] = localPort;
				}
			});

			return localPorts;
		}).future<IDictionary<number>>()();
	}

	public getDebuggableApps(deviceIdentifier: string): IFuture<Mobile.IDeviceApplicationInformation[]> {
		return ((): Mobile.IDeviceApplicationInformation[] => {
			let adb = this.getAdb(deviceIdentifier);
			let androidWebViewPortInformation = (<string>this.getAbstractPortsInformation(adb).wait()).split(EOL);

			// TODO: Add tests and make sure only unique names are returned. Input before groupBy is:
			// [ { deviceIdentifier: 'SH26BW100473',
			// 	appIdentifier: 'com.telerik.EmptyNS',
			// 	framework: 'NativeScript' },
			// 	{ deviceIdentifier: 'SH26BW100473',
			// 	appIdentifier: 'com.telerik.EmptyNS',
			// 	framework: 'Cordova' },
			// 	{ deviceIdentifier: 'SH26BW100473',
			// 	appIdentifier: 'chrome',
			// 	framework: 'Cordova' },
			// 	{ deviceIdentifier: 'SH26BW100473',
			// 	appIdentifier: 'chrome',
			// 	framework: 'Cordova' } ]
			return _(androidWebViewPortInformation)
				.map(line => this.getApplicationInfoFromWebViewPortInformation(adb, deviceIdentifier, line).wait()
					|| this.getNativeScriptApplicationInformation(adb, deviceIdentifier, line).wait()
				)
				.filter(deviceAppInfo => !!deviceAppInfo)
				.groupBy(element => element.framework)
				.map((group: Mobile.IDeviceApplicationInformation[]) => _.uniqBy(group, g => g.appIdentifier))
				.flatten<Mobile.IDeviceApplicationInformation>()
				.value();
		}).future<Mobile.IDeviceApplicationInformation[]>()();
	}

	private getApplicationInfoFromWebViewPortInformation(adb: Mobile.IDeviceAndroidDebugBridge, deviceIdentifier: string, information: string): IFuture<Mobile.IDeviceApplicationInformation> {
		return ((): Mobile.IDeviceApplicationInformation => {
			// Need to search by processId to check for old Android webviews (@webview_devtools_remote_<processId>).
			let processIdRegExp = /@webview_devtools_remote_(.+)/g,
				processIdMatches = processIdRegExp.exec(information),
				cordovaAppIdentifier: string;

			if (processIdMatches) {
				let processId = processIdMatches[1];
				cordovaAppIdentifier = this.getApplicationIdentifierFromPid(adb, processId).wait();
			} else {
				// Search for appIdentifier (@<appIdentifier>_devtools_remote).
				let chromeAppIdentifierRegExp = /@(.+)_devtools_remote\s?/g;
				let chromeAppIdentifierMatches = chromeAppIdentifierRegExp.exec(information);

				if (chromeAppIdentifierMatches && chromeAppIdentifierMatches.length > 0) {
					cordovaAppIdentifier = chromeAppIdentifierMatches[1];
				}
			}

			if (cordovaAppIdentifier) {
				return {
					deviceIdentifier: deviceIdentifier,
					appIdentifier: cordovaAppIdentifier,
					framework: TARGET_FRAMEWORK_IDENTIFIERS.Cordova
				};
			}

			return null;
		}).future<Mobile.IDeviceApplicationInformation>()();
	}

	private getNativeScriptApplicationInformation(adb: Mobile.IDeviceAndroidDebugBridge, deviceIdentifier: string, information: string): IFuture<Mobile.IDeviceApplicationInformation> {
		return ((): Mobile.IDeviceApplicationInformation => {
			// Search for appIdentifier (@<appIdentifier-debug>).
			let nativeScriptAppIdentifierRegExp = /@(.+)-debug/g;
			let nativeScriptAppIdentifierMatches = nativeScriptAppIdentifierRegExp.exec(information);

			if (nativeScriptAppIdentifierMatches && nativeScriptAppIdentifierMatches.length > 0) {
				let appIdentifier = nativeScriptAppIdentifierMatches[1];
				return {
					deviceIdentifier: deviceIdentifier,
					appIdentifier: appIdentifier,
					framework: TARGET_FRAMEWORK_IDENTIFIERS.NativeScript
				};
			}

			return null;
		}).future<Mobile.IDeviceApplicationInformation>()();
	}

	private getAbstractPortForApplication(adb: Mobile.IDeviceAndroidDebugBridge, processId: string | number, appIdentifier: string, abstractPortsInformation: string, framework: string): IFuture<string> {
		return (() => {
			// The result will look like this (without the columns names):
			// Num       		 RefCount Protocol Flags    Type St Inode  Path
			// 0000000000000000: 00000002 00000000 00010000 0001 01 189004 @webview_devtools_remote_25512
			// The Path column is the abstract port.

			framework = framework || "";

			switch (framework.toLowerCase()) {
				case TARGET_FRAMEWORK_IDENTIFIERS.Cordova.toLowerCase():
					return this.getCordovaPortInformation(abstractPortsInformation, appIdentifier, processId);
				case TARGET_FRAMEWORK_IDENTIFIERS.NativeScript.toLowerCase():
					return this.getNativeScriptPortInformation(abstractPortsInformation, appIdentifier);
				default:
					return this.getCordovaPortInformation(abstractPortsInformation, appIdentifier, processId) ||
						this.getNativeScriptPortInformation(abstractPortsInformation, appIdentifier);
			}

		}).future<string>()();
	}

	private getCordovaPortInformation(abstractPortsInformation: string, appIdentifier: string, processId: string | number): string {
		return this.getPortInformation(abstractPortsInformation, `${appIdentifier}_devtools_remote`) || this.getPortInformation(abstractPortsInformation, processId);
	}

	private getNativeScriptPortInformation(abstractPortsInformation: string, appIdentifier: string): string {
		return this.getPortInformation(abstractPortsInformation, `${appIdentifier}-debug`);
	}

	private getAbstractPortsInformation(adb: Mobile.IDeviceAndroidDebugBridge): IFuture<string> {
		return adb.executeShellCommand(["cat", "/proc/net/unix"]);
	}

	private getPortInformation(abstractPortsInformation: string, searchedInfo: string | number): string {
		let processRegExp = new RegExp(`\\w+:\\s+(?:\\w+\\s+){1,6}@(.*?${searchedInfo})$`, "gm");

		let match = processRegExp.exec(abstractPortsInformation);
		return match && match[1];
	}

	private getProcessIds(adb: Mobile.IDeviceAndroidDebugBridge, appIdentifiers: string[]): IFuture<IDictionary<number>> {
		return (() => {
			// Process information will look like this (without the columns names):
			// USER     PID   PPID  VSIZE   RSS   WCHAN    PC         NAME
			// u0_a63   25512 1334  1519560 96040 ffffffff f76a8f75 S com.telerik.appbuildertabstest
			let result: IDictionary<number> = {};
			let processIdInformation: string = adb.executeShellCommand(["ps"]).wait();
			_.each(appIdentifiers, appIdentifier => {
				let processIdRegExp = new RegExp(`^\\w*\\s*(\\d+).*?${appIdentifier}$`);
				result[appIdentifier] = this.getFirstMatchingGroupFromMultilineResult<number>(processIdInformation, processIdRegExp);
			});

			return result;
		}).future<IDictionary<number>>()();
	}

	private getAlreadyMappedPort(adb: Mobile.IDeviceAndroidDebugBridge, deviceIdentifier: string, abstractPort: string, adbForwardList?: any): IFuture<number> {
		return ((): number => {
			let allForwardedPorts: string = adbForwardList || adb.executeCommand(["forward", "--list"]).wait() || "";

			// Sample output:
			// 5e2e580b tcp:62503 localabstract:webview_devtools_remote_7985
			// 5e2e580b tcp:62524 localabstract:webview_devtools_remote_7986
			// 5e2e580b tcp:63160 localabstract:webview_devtools_remote_7987
			// 5e2e580b tcp:57577 localabstract:com.telerik.nrel-debug
			let regex = new RegExp(`${deviceIdentifier}\\s+?tcp:(\\d+?)\\s+?.*?${abstractPort}$`);

			return this.getFirstMatchingGroupFromMultilineResult<number>(allForwardedPorts, regex);
		}).future<number>()();
	}

	private getAdb(deviceIdentifier: string): Mobile.IDeviceAndroidDebugBridge {
		if (!this._devicesAdbs[deviceIdentifier]) {
			this._devicesAdbs[deviceIdentifier] = this.$injector.resolve(DeviceAndroidDebugBridge, { identifier: deviceIdentifier });
		}

		return this._devicesAdbs[deviceIdentifier];
	}

	private getApplicationIdentifierFromPid(adb: Mobile.IDeviceAndroidDebugBridge, pid: string, psData?: string): IFuture<string> {
		return ((): string => {
			psData = psData || adb.executeShellCommand(["ps"]).wait();
			// Process information will look like this (without the columns names):
			// USER     PID   PPID  VSIZE   RSS   WCHAN    PC         NAME
			// u0_a63   25512 1334  1519560 96040 ffffffff f76a8f75 S com.telerik.appbuildertabstest
			return this.getFirstMatchingGroupFromMultilineResult<string>(psData, new RegExp(`\\s+${pid}(?:\\s+\\d+){3}\\s+.*\\s+(.*?)$`));
		}).future<string>()();
	}

	private getFirstMatchingGroupFromMultilineResult<T>(input: string, regex: RegExp): T {
		let result: T;

		_((input || "").split('\n'))
			.map(line => line.trim())
			.filter(line => !!line)
			.each(line => {
				let matches = line.match(regex);
				if (matches && matches[1]) {
					result = <any>matches[1];
					return false;
				}
			});

		return result;
	}

	private tryAttachToProcessExitSignals(): void {
		if (this._shouldAddProcessExitEventListeners) {
			attachToProcessExitSignals(this, () => {
				return (() => {
					_.each(this._forwardedLocalPorts, (port: number) => {
						// We need to use shelljs here instead of $adb because listener functions of exit, SIGINT and SIGTERM must only perform synchronous operations.
						// The Node.js process will exit immediately after calling the 'exit' event listeners causing any additional work still queued in the event loop to be abandoned.
						// See the official documentation for more information and examples - https://nodejs.org/dist/latest-v6.x/docs/api/process.html#process_event_exit.
						shelljs.exec(`adb forward --remove tcp:${port}`);
					});
				}).future<void>()();
			});

			this._shouldAddProcessExitEventListeners = false;
		}
	}
}

$injector.register("androidProcessService", AndroidProcessService);
