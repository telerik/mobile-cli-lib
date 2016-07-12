import {EOL} from "os";
import {DeviceAndroidDebugBridge} from "../android/device-android-debug-bridge";
import {TARGET_FRAMEWORK_IDENTIFIERS} from "../../constants";

export class AndroidProcessService implements Mobile.IAndroidProcessService {
	private _devicesAdbs: IDictionary<Mobile.IDeviceAndroidDebugBridge>;

	constructor(private $errors: IErrors,
		private $staticConfig: Config.IStaticConfig,
		private $injector: IInjector,
		private $httpClient: Server.IHttpClient,
		private $net: INet) {
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

			let localPort = this.getAlreadyMappedPort(adb, deviceIdentifier, abstractPort).wait();

			if (!localPort) {
				localPort = this.$net.getFreePort().wait();
				adb.executeCommand(["forward", `tcp:${localPort}`, `localabstract:${abstractPort}`]).wait();
			}

			return localPort;
		}).future<string>()();
	}

	public getDebuggableApps(deviceIdentifier: string): IFuture<Mobile.IDeviceApplicationInformation[]> {
		return ((): Mobile.IDeviceApplicationInformation[] => {
			let adb = this.getAdb(deviceIdentifier);
			let androidWebViewPortInformation = (<string>this.getAbstractPortsInformation(adb).wait()).split(EOL);

			// TODO: Add tests and make sure only unique names are returned.
			return _(androidWebViewPortInformation)
				.map((line: string) => this.getApplicationInfoFromWebViewPortInformation(adb, deviceIdentifier, line).wait())
				.filter(appIdentifier => !!appIdentifier)
				.uniqBy("appIdentifier")
				.value();
		}).future<Mobile.IDeviceApplicationInformation[]>()();
	}

	private getApplicationInfoFromWebViewPortInformation(adb: Mobile.IDeviceAndroidDebugBridge, deviceIdentifier: string, information: string): IFuture<Mobile.IDeviceApplicationInformation> {
		return ((): Mobile.IDeviceApplicationInformation => {
			// Need to search by processId to check for old Android webviews (@webview_devtools_remote_<processId>).
			let processIdRegExp = /@webview_devtools_remote_(.+)/g;
			let processIdMatches = processIdRegExp.exec(information);
			let oldAndroidWebViewAppIdentifier: string;
			if (processIdMatches) {
				let processId = processIdMatches[1];
				// Process information will look like this (without the columns names):
				// USER     PID   PPID  VSIZE   RSS   WCHAN    PC         NAME
				// u0_a63   25512 1334  1519560 96040 ffffffff f76a8f75 S com.telerik.appbuildertabstest
				let processIdInformation: string = adb.executeShellCommand(["ps", "|grep", processId]).wait();
				oldAndroidWebViewAppIdentifier = _.last(processIdInformation.trim().split(/[ \t]/));
			}

			// Search for appIdentifier (@<appIdentifier>_devtools_remote).
			let chromeAppIdentifierRegExp = /@(.+)_devtools_remote\s?/g;
			let chromeAppIdentifierMatches = chromeAppIdentifierRegExp.exec(information);
			let chromeAppIdentifier: string;

			if (chromeAppIdentifierMatches && chromeAppIdentifierMatches.length > 0) {
				chromeAppIdentifier = chromeAppIdentifierMatches[1];
			}

			let cordovaAppIdentifier = oldAndroidWebViewAppIdentifier || chromeAppIdentifier;

			if (cordovaAppIdentifier) {
				return {
					deviceIdentifier: deviceIdentifier,
					appIdentifier: cordovaAppIdentifier,
					framework: TARGET_FRAMEWORK_IDENTIFIERS.Cordova
				};
			}

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
			let processIdRegExp = new RegExp(`^\\w*\\s*(\\d+).*?${appIdentifier}$`);
			let processIdInformation: string = adb.executeShellCommand(["ps"]).wait();

			return this.parseMultilineResult(processIdInformation, processIdRegExp);
		}).future<string>()();
	}

	private getAlreadyMappedPort(adb: Mobile.IDeviceAndroidDebugBridge, deviceIdentifier: string, abstractPort: string): IFuture<number> {
		return ((): number => {
			let allForwardedPorts: string = adb.executeCommand(["forward", "--list"]).wait() || "";
			// Sample output:
			// 5e2e580b tcp:62503 localabstract:webview_devtools_remote_7985
			// 5e2e580b tcp:62524 localabstract:webview_devtools_remote_7986
			// 5e2e580b tcp:63160 localabstract:webview_devtools_remote_7987
			// 5e2e580b tcp:57577 localabstract:com.telerik.nrel-debug
			let regex = new RegExp(`${deviceIdentifier}\\s+?tcp:(\\d+?)\\s+?.*?${abstractPort}.*$`);

			return this.parseMultilineResult(allForwardedPorts, regex);
		}).future<number>()();
	}

	private getAdb(deviceIdentifier: string): Mobile.IDeviceAndroidDebugBridge {
		if (!this._devicesAdbs[deviceIdentifier]) {
			this._devicesAdbs[deviceIdentifier] = this.$injector.resolve(DeviceAndroidDebugBridge, { identifier: deviceIdentifier });
		}

		return this._devicesAdbs[deviceIdentifier];
	}

	private parseMultilineResult(input: string, regex: RegExp): number {
		let selectedNumber: number;

		_((input || "").split('\n'))
			.map(line => line.trim())
			.filter(line => !!line)
			.each(line => {
				let matches = line.match(regex);
				if (matches && matches[1]) {
					selectedNumber = +matches[1];
					return false;
				}
			});

		return selectedNumber;
	}
}

$injector.register("androidProcessService", AndroidProcessService);
