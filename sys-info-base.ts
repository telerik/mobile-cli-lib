import * as os from "os";
import * as osenv from "osenv";
import * as path from "path";
import { quoteString } from "./helpers";

export class SysInfoBase implements ISysInfo {
	constructor(protected $childProcess: IChildProcess,
		protected $hostInfo: IHostInfo,
		protected $iTunesValidator: Mobile.IiTunesValidator,
		protected $logger: ILogger,
		protected $winreg: IWinReg,
		protected $androidEmulatorServices: Mobile.IAndroidEmulatorServices) { }

	private monoVerRegExp = /version (\d+[.]\d+[.]\d+) /gm;
	private sysInfoCache: ISysInfoData = undefined;

	private npmVerCache: string = null;
	public async getNpmVersion(): Promise<string> {
		if (!this.npmVerCache) {
			const procOutput = await this.exec("npm -v");
			this.npmVerCache = procOutput ? procOutput.split("\n")[0] : null;
		}

		return this.npmVerCache;
	}

	private javaCompilerVerCache: string = null;
	public async getJavaCompilerVersion(): Promise<string> {
		if (!this.javaCompilerVerCache) {
			const javaCompileExecutableName = "javac";
			const javaHome = process.env.JDK_HOME || process.env.JAVA_HOME;
			const pathToJavaCompilerExecutable = javaHome ? path.join(javaHome, "bin", javaCompileExecutableName) : javaCompileExecutableName;
			try {
				const output = await this.exec(`"${pathToJavaCompilerExecutable}" -version`, { showStderr: true });
				// for other versions of java javac version output is not on first line
				// thus can't use ^ for starts with in regex
				this.javaCompilerVerCache = output ? /javac (.*)/i.exec(`${output.stderr}${os.EOL}${output.stdout}`)[1] : null;
			} catch (e) {
				this.$logger.trace(`Command "${pathToJavaCompilerExecutable} --version" failed: ${e}`);
				this.javaCompilerVerCache = null;
			}
		}

		return this.javaCompilerVerCache;
	}

	private xCodeVerCache: string = null;
	public async getXCodeVersion(): Promise<string> {
		if (!this.xCodeVerCache) {
			this.xCodeVerCache = this.$hostInfo.isDarwin ? await this.exec("xcodebuild -version") : null;
		}

		return this.xCodeVerCache;
	}

	private nodeGypVerCache: string = null;
	public async getNodeGypVersion(): Promise<string> {
		if (!this.nodeGypVerCache) {
			try {
				this.nodeGypVerCache = await this.exec("node-gyp -v");
			} catch (e) {
				this.$logger.trace(`Command "node-gyp -v" failed: ${e}`);
				this.nodeGypVerCache = null;
			}
		}
		return this.nodeGypVerCache;
	}

	private xcodeprojGemLocationCache: string = null;
	public async getXCodeProjGemLocation(): Promise<string> {
		if (!this.xcodeprojGemLocationCache) {
			try {
				this.xcodeprojGemLocationCache = this.$hostInfo.isDarwin ? await this.exec("gem which xcodeproj") : null;
			} catch (e) {
				this.$logger.trace(`Command "gem which xcodeproj" failed with: ${e}`);
				this.xcodeprojGemLocationCache = null;
			}
		}
		return this.xcodeprojGemLocationCache;
	}

	private itunesInstalledCache: boolean = null;

	public getITunesInstalled(): boolean {
		if (!this.itunesInstalledCache) {
			try {
				this.itunesInstalledCache = this.$iTunesValidator.getError() === null;
			} catch (e) {
				this.itunesInstalledCache = null;
			}
		}
		return this.itunesInstalledCache;
	}

	private cocoapodVersionCache: string = null;
	public async getCocoapodVersion(): Promise<string> {
		if (!this.cocoapodVersionCache) {
			try {
				if (this.$hostInfo.isDarwin) {
					let cocoapodVersion = await this.exec("pod --version");
					if (cocoapodVersion) {
						// Output of pod --version could contain some warnings. Find the version in it.
						const cocoapodVersionMatch = cocoapodVersion.match(/^((?:\d+\.){2}\d+.*?)$/gm);
						if (cocoapodVersionMatch && cocoapodVersionMatch[0]) {
							cocoapodVersion = cocoapodVersionMatch[0].trim();
						}

						this.cocoapodVersionCache = cocoapodVersion;
					}
				}
			} catch (e) {
				this.$logger.trace(e);
				this.cocoapodVersionCache = null;
			}
		}

		return this.cocoapodVersionCache;
	}

	public async getSysInfo(pathToPackageJson: string, androidToolsInfo?: { pathToAdb: string }): Promise<ISysInfoData> {
		if (!this.sysInfoCache) {
			const res: ISysInfoData = Object.create(null);
			let procOutput: string;

			const packageJson = require(pathToPackageJson);
			res.procInfo = packageJson.name + "/" + packageJson.version;

			// os stuff
			res.platform = os.platform();
			res.os = this.$hostInfo.isWindows ? await this.winVer() : await this.unixVer();
			res.shell = osenv.shell();
			try {
				res.dotNetVer = await this.$hostInfo.dotNetVersion();
			} catch (err) {
				res.dotNetVer = ".Net is not installed.";
			}

			// node stuff
			res.procArch = process.arch;
			res.nodeVer = process.version;

			res.npmVer = await this.getNpmVersion();

			res.nodeGypVer = await this.getNodeGypVersion();
			res.xcodeVer = await this.getXCodeVersion();
			res.xcodeprojGemLocation = await this.getXCodeProjGemLocation();
			res.itunesInstalled = this.getITunesInstalled();

			res.cocoapodVer = await this.getCocoapodVersion();
			const pathToAdb = androidToolsInfo ? androidToolsInfo.pathToAdb : "adb";

			if (!androidToolsInfo) {
				this.$logger.trace("'adb' and 'android' will be checked from PATH environment variable.");
			}

			procOutput = await this.exec(`${quoteString(pathToAdb)} version`);
			res.adbVer = procOutput ? procOutput.split(os.EOL)[0] : null;

			res.emulatorInstalled = await this.checkEmulator();

			procOutput = await this.exec("mono --version");
			if (!!procOutput) {
				const match = this.monoVerRegExp.exec(procOutput);
				res.monoVer = match ? match[1] : null;
			} else {
				res.monoVer = null;
			}

			procOutput = await this.exec("git --version");
			res.gitVer = procOutput ? /^git version (.*)/.exec(procOutput)[1] : null;

			procOutput = await this.exec("gradle -v");
			res.gradleVer = procOutput ? /Gradle (.*)/i.exec(procOutput)[1] : null;

			res.javacVersion = await this.getJavaCompilerVersion();

			this.sysInfoCache = res;
		}

		return this.sysInfoCache;
	}

	private async exec(cmd: string, execOptions?: IExecOptions): Promise<string | any> {
		try {
			if (cmd) {
				return await this.$childProcess.exec(cmd, null, execOptions);
			}
		} catch (e) {
			// if we got an error, assume not working
			this.$logger.trace(`Error while executing ${cmd}: ${e.message}`);
		}

		return null;
	}

	private async checkEmulator(): Promise<boolean> {
		// emulator -help exits with code 1 on Windows, so we should parse the output.
		// First line of it should be:
		// Android Emulator usage: emulator [options] [-qemu args]
		const emulatorHelp = await this.$childProcess.spawnFromEvent(this.$androidEmulatorServices.pathToEmulatorExecutable, ["-help"], "close", {}, { throwError: false });
		const result = !!(emulatorHelp && emulatorHelp.stdout && emulatorHelp.stdout.indexOf("usage: emulator") !== -1);
		this.$logger.trace(`The result of checking is Android Emulator installed is:${os.EOL}- stdout: ${emulatorHelp && emulatorHelp.stdout}${os.EOL}- stderr: ${emulatorHelp && emulatorHelp.stderr}`);

		return result;
	}

	private async winVer(): Promise<string> {
		try {
			return await this.readRegistryValue("ProductName") + " " +
				await this.readRegistryValue("CurrentVersion") + "." +
				await this.readRegistryValue("CurrentBuild");
		} catch (err) {
			this.$logger.trace(err);
		}

		return null;
	}

	private async readRegistryValue(valueName: string): Promise<string> {
		return (await this.$winreg.getRegistryValue(valueName, this.$winreg.registryKeys.HKLM, '\\Software\\Microsoft\\Windows NT\\CurrentVersion')).value;
	}

	private unixVer(): Promise<string> {
		return this.exec("uname -a");
	}
}
$injector.register("sysInfoBase", SysInfoBase);
