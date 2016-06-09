import * as os from "os";
import * as osenv from "osenv";
import * as path from "path";
import {quoteString} from "./helpers";

export class SysInfoBase implements ISysInfo {
	constructor(protected $childProcess: IChildProcess,
				protected $hostInfo: IHostInfo,
				protected $iTunesValidator: Mobile.IiTunesValidator,
				protected $logger: ILogger,
				protected $winreg: IWinReg) { }

	private monoVerRegExp = /version (\d+[.]\d+[.]\d+) /gm;
	private sysInfoCache: ISysInfoData = undefined;

	public getSysInfo(pathToPackageJson: string, androidToolsInfo?: {pathToAdb: string, pathToAndroid: string}): IFuture<ISysInfoData> {
		return((): ISysInfoData => {
			if (!this.sysInfoCache) {
				let res: ISysInfoData = Object.create(null);
				let procOutput: string;

				let packageJson = require(pathToPackageJson);
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

				procOutput = this.exec("npm -v");
				res.npmVer = procOutput ? procOutput.split("\n")[0] : null;

				// dependencies
				try {
					// different java has different format for `java -version` command
					let output = this.$childProcess.spawnFromEvent("java", ["-version"], "exit").wait().stderr;
					res.javaVer = /(?:openjdk|java) version \"((?:\d+\.)+(?:\d+))/i.exec(output)[1];
				} catch(e) {
					res.javaVer = null;
				}

				res.nodeGypVer = this.exec("node-gyp -v");
				res.xcodeVer = this.$hostInfo.isDarwin ? this.exec("xcodebuild -version") : null;
				res.xcodeprojGemLocation = this.$hostInfo.isDarwin ? this.exec("gem which xcodeproj") : null;
				res.itunesInstalled = this.$iTunesValidator.getError().wait() === null;

				res.cocoapodVer = this.getCocoapodVersion();
				let pathToAdb = androidToolsInfo ? androidToolsInfo.pathToAdb : "adb";
				let pathToAndroid = androidToolsInfo ? androidToolsInfo.pathToAndroid : "android";

				if(!androidToolsInfo) {
					this.$logger.trace("'adb' and 'android' will be checked from PATH environment variable.");
				}

				procOutput = this.exec(`${quoteString(pathToAdb)} version`);
				res.adbVer = procOutput ? procOutput.split(os.EOL)[0] : null;

				res.androidInstalled = this.checkAndroid(pathToAndroid).wait();

				procOutput = this.exec("mono --version");
				if (!!procOutput) {
					let match = this.monoVerRegExp.exec(procOutput);
					res.monoVer = match ? match[1] : null;
				} else {
					res.monoVer = null;
				}

				procOutput = this.exec("git --version");
				res.gitVer = procOutput ? /^git version (.*)/.exec(procOutput)[1]  : null;

				procOutput = this.exec("gradle -v");
				res.gradleVer = procOutput ? /Gradle (.*)/i.exec(procOutput)[1] : null;

				res.javacVersion = this.getJavaCompilerVersion().wait();

				this.sysInfoCache = res;
			}

			return this.sysInfoCache;
		}).future<ISysInfoData>()();
	}

	private exec(cmd: string, execOptions?: IExecOptions): string | any {
		try {
			if(cmd) {
				return this.$childProcess.exec(cmd, null, execOptions).wait();
			}
		} catch(e) {
			// if we got an error, assume not working
		}

		return null;
	}

	// `android -h` returns exit code 1 on successful invocation (Mac OS X for now, possibly Linux). Therefore, we cannot use $childProcess
	private checkAndroid(pathToAndroid: string): IFuture<boolean> {
		return ((): boolean => {
			let result = false;
			try {
				if(pathToAndroid) {
					let androidChildProcess = this.$childProcess.spawnFromEvent(pathToAndroid, ["-h"], "close", {}, {throwError: false}).wait();
					result = androidChildProcess && androidChildProcess.stdout && _.contains(androidChildProcess.stdout, "android");
				}
			} catch(err) {
				this.$logger.trace(`Error while checking is ${pathToAndroid} installed. Error is: ${err.messge}`);
			}

			return result;
		}).future<boolean>()();
	}

	private winVer(): string {
		try {
			return this.readRegistryValue("ProductName").wait() + " " +
					this.readRegistryValue("CurrentVersion").wait() + "." +
					this.readRegistryValue("CurrentBuild").wait();
		} catch (err) {
			this.$logger.trace(err);
		}

		return null;
	}

	private readRegistryValue(valueName: string): IFuture<string> {
		return ((): string => {
			return this.$winreg.getRegistryValue(valueName, this.$winreg.registryKeys.HKLM, '\\Software\\Microsoft\\Windows NT\\CurrentVersion').wait().value;
		}).future<string>()();
	}

	private unixVer(): string {
		return this.exec("uname -a");
	}

	private getJavaCompilerVersion(): IFuture<string> {
		return ((): string => {
			let javaCompileExecutableName = "javac";
			let javaHome = process.env.JAVA_HOME;
			let pathToJavaCompilerExecutable = javaHome ? path.join(javaHome, "bin", javaCompileExecutableName) : javaCompileExecutableName;
			let output = this.exec(`"${pathToJavaCompilerExecutable}" -version`, { showStderr: true });
			// for other versions of java javac version output is not on first line
			// thus can't use ^ for starts with in regex
			return output ? /javac (.*)/i.exec(output.stderr)[1]: null;
		}).future<string>()();
	}

	private getCocoapodVersion(): string {
		if(this.$hostInfo.isDarwin) {
			let cocoapodVersion = this.exec("pod --version");
			if(cocoapodVersion) {
				// Output of pod --version could contain some warnings. Find the version in it.
				let cocoapodVersionMatch = cocoapodVersion.match(/^((?:\d+\.){2}\d+.*?)$/gm);
				if(cocoapodVersionMatch && cocoapodVersionMatch[0]) {
					cocoapodVersion = cocoapodVersionMatch[0].trim();
				}

				return cocoapodVersion;
			}
		}

		return null;
	}
}
$injector.register("sysInfoBase", SysInfoBase);
