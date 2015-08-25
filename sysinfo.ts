///<reference path=".d.ts"/>
"use strict";

import * as os from "os";
import * as child_process from "child_process";
import * as osenv from "osenv";
import Future = require("fibers/future");

export class SysInfo implements ISysInfo {
	constructor(private $childProcess: IChildProcess,
				private $iTunesValidator: Mobile.IiTunesValidator,
				private $logger: ILogger,
		private $hostInfo: IHostInfo) { }

	private static monoVerRegExp = /version (\d+[.]\d+[.]\d+) /gm;
	private sysInfoCache: ISysInfoData = undefined;

	getSysInfo(): ISysInfoData {
		if (!this.sysInfoCache) {
			let res: ISysInfoData = Object.create(null);
			let procOutput: string;

			let packageJson = require("../../package.json");
			res.procInfo = packageJson.name + "/" + packageJson.version;

			// os stuff
			res.platform = os.platform();
			res.os = this.$hostInfo.isWindows ? this.winVer() : this.unixVer();
			res.shell = osenv.shell();
			try {
				res.dotNetVer = this.$hostInfo.dotNetVersion().wait();
			} catch(err) {
				res.dotNetVer = ".Net is not installed.";
			}

			// node stuff
			res.procArch = process.arch;
			res.nodeVer = process.version;

			procOutput = this.$childProcess.exec("npm -v").wait();
			res.npmVer = procOutput ? procOutput.split("\n")[0] : null;

			// dependencies
			try {
				let output = this.$childProcess.spawnFromEvent("java", ["-version"], "exit").wait().stderr.split(os.EOL)[0];
				res.javaVer = /^java version \"((?:\d+\.)+(?:\d+))/i.exec(output)[1];
			} catch(e) {
				res.javaVer = null;
			}

			procOutput = this.exec("ant -version");
			res.antVer = procOutput ? procOutput.split(os.EOL)[0] : null;

			res.nodeGypVer = this.exec("node-gyp -v");
			res.xcodeVer = this.$hostInfo.isDarwin ? this.exec("xcodebuild -version") : null;
			res.itunesInstalled = this.$iTunesValidator.getError().wait() === null;

			procOutput = this.exec("adb version");
			res.adbVer = procOutput ? procOutput.split(os.EOL)[0] : null;

			procOutput = this.execAndroidH();
			res.androidInstalled = procOutput ? _.contains(procOutput, "android") : false;

			procOutput = this.exec("mono --version");
			if (!!procOutput) {
				let match = SysInfo.monoVerRegExp.exec(procOutput);
				res.monoVer = match ? match[1] : null;
			} else {
				res.monoVer = null;
			}

			procOutput = this.exec("git --version");
			res.gitVer = procOutput ? /^git version (.*)/.exec(procOutput)[1]  : null;

			this.sysInfoCache = res;
		}

		return this.sysInfoCache;
	}

	private exec(cmd: string): string {
		try {
			return this.$childProcess.exec(cmd).wait();
		} catch(e) {
			return null;
		} // if we got an error, assume not working
	}

	// `android -h` returns exit code 1 on successful invocation (Mac OS X for now, possibly Linux). Therefore, we cannot use $childProcess
	private execAndroidH(): string {
		let future = new Future<any>();
		let callback = (error: Error, stdout: NodeBuffer, stderr: NodeBuffer) => {
			this.$logger.trace("Exec android -h \n stdout: %s \n stderr: %s", stdout.toString(), stderr.toString());

			let err: any = error;
			if(error && err.code !== 1 && !err.killed && !err.signal) {
				future.return(null);
			} else {
				future.return(stdout);
			}
		};

		child_process.exec("android -h", callback);

		let result = future.wait();
		return result;
	}

	private winVer(): string {
		return this.readRegistryValue("ProductName").wait() + " " +
				this.readRegistryValue("CurrentVersion").wait() + "." +
				this.readRegistryValue("CurrentBuild").wait();
	}

	private readRegistryValue(valueName: string): IFuture<string> {
		let future = new Future<string>();
		let Winreg = require("winreg");
		let regKey = new Winreg({
			hive: Winreg.HKLM,
			key:  '\\Software\\Microsoft\\Windows NT\\CurrentVersion'
		});
		regKey.get(valueName, (err: Error, value: any) => {
			if (err) {
				future.throw(err);
			} else {
				future.return(value.value);
			}
		});
		return future;
	}

	private unixVer(): string {
		return this.$childProcess.exec("uname -a").wait();
	}
}
$injector.register("sysInfo", SysInfo);
