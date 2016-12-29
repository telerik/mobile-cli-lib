import {ApplicationManagerBase} from "../../application-manager-base";
import Future = require("fibers/future");
import * as path from "path";
import * as temp from "temp";
import { hook } from "../../../helpers";

export class IOSSimulatorApplicationManager extends ApplicationManagerBase {
	constructor(private iosSim: any,
		private identifier: string,
		private $options: ICommonOptions,
		private $fs: IFileSystem,
		private $bplistParser: IBinaryPlistParser,
		private $iOSSimulatorLogProvider: Mobile.IiOSSimulatorLogProvider,
		private $deviceLogProvider: Mobile.IDeviceLogProvider,
		$logger: ILogger,
		$hooksService: IHooksService) {
		super($logger, $hooksService);
	}

	public async getInstalledApplications(): Promise<string[]> {
		return Promise.resolve(this.iosSim.getInstalledApplications(this.identifier));
	}

	// TODO: Remove Promise, reason: readDirectory - cannot until android and iOS implementatios have async calls.
	@hook('install')
	public async installApplication(packageFilePath: string): Promise<void> {
			if (this.$fs.exists(packageFilePath) && path.extname(packageFilePath) === ".zip") {
				temp.track();
				let dir = temp.mkdirSync("simulatorPackage");
				await this.$fs.unzip(packageFilePath, dir);
				let app = _.find(this.$fs.readDirectory(dir), directory => path.extname(directory) === ".app");
				if (app) {
					packageFilePath = path.join(dir, app);
				}
			}

			await this.iosSim.installApplication(this.identifier, packageFilePath);
	}

	public async uninstallApplication(appIdentifier: string): Promise<void> {
		return this.iosSim.uninstallApplication(this.identifier, appIdentifier);
	}

	public async startApplication(appIdentifier: string): Promise<void> {
			let launchResult = await  this.iosSim.startApplication(this.identifier, appIdentifier);

			if (!this.$options.justlaunch) {
				let pid = launchResult.split(":")[1].trim();
				this.$deviceLogProvider.setApplictionPidForDevice(this.identifier, pid);
				this.$iOSSimulatorLogProvider.startLogProcess(this.identifier);
			}
	}

	public async stopApplication(cfBundleExecutable: string): Promise<void> {
		return this.iosSim.stopApplication(this.identifier, cfBundleExecutable);
	}

	public canStartApplication(): boolean {
		return true;
	}

	public async getApplicationInfo(applicationIdentifier: string): Promise<Mobile.IApplicationInfo> {
			let result: Mobile.IApplicationInfo = null,
				plistContent = await  this.getParsedPlistContent(applicationIdentifier);

			if (plistContent) {
				result = {
					applicationIdentifier,
					deviceIdentifier: this.identifier,
					configuration: plistContent && plistContent.configuration
				};
			}

			return result;
	}

	public async isLiveSyncSupported(appIdentifier: string): Promise<boolean> {
			let plistContent = await this.getParsedPlistContent(appIdentifier);
			if (plistContent) {
				return !!plistContent && !!plistContent.IceniumLiveSyncEnabled;
			}

			return false;
	}

	private async getParsedPlistContent(appIdentifier: string): Promise<any> {
		if (! await this.isApplicationInstalled(appIdentifier)) {
			return null;
		}

		let applicationPath = this.iosSim.getApplicationPath(this.identifier, appIdentifier),
			pathToInfoPlist = path.join(applicationPath, "Info.plist");

		return this.$fs.exists(pathToInfoPlist) ? (await this.$bplistParser.parseFile(pathToInfoPlist))[0] : null;
	}

	public async getDebuggableApps(): Promise<Mobile.IDeviceApplicationInformation[]> {
		return Promise.resolve([]);
	}

	public async getDebuggableAppViews(appIdentifiers: string[]): Promise<IDictionary<Mobile.IDebugWebViewInfo[]>> {
		// Implement when we can find debuggable applications for iOS.
		return Promise.resolve(null);
	}
}
