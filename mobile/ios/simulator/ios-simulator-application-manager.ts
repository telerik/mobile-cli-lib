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

	public getInstalledApplications(): IFuture<string[]> {
		return Future.fromResult(this.iosSim.getInstalledApplications(this.identifier));
	}

	// TODO: Remove IFuture, reason: readDirectory - cannot until android and iOS implementatios have async calls.
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

	public uninstallApplication(appIdentifier: string): IFuture<void> {
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

	public stopApplication(cfBundleExecutable: string): IFuture<void> {
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
			let plistContent = await  this.getParsedPlistContent(appIdentifier);
			if (plistContent) {
				return !!plistContent && !!plistContent.IceniumLiveSyncEnabled;
			}

			return false;
	}

	private getParsedPlistContent(appIdentifier: string): any {
		return ((): any => {
			if (! await this.isApplicationInstalled(appIdentifier)) {
				return null;
			}

			let applicationPath = this.iosSim.getApplicationPath(this.identifier, appIdentifier),
				pathToInfoPlist = path.join(applicationPath, "Info.plist");

			await return this.$fs.exists(pathToInfoPlist) ? this.$bplistParser.parseFile(pathToInfoPlist)[0] : null;
		}).future<any>()();
	}

	public getDebuggableApps(): IFuture<Mobile.IDeviceApplicationInformation[]> {
		return Future.fromResult([]);
	}

	public getDebuggableAppViews(appIdentifiers: string[]): IFuture<IDictionary<Mobile.IDebugWebViewInfo[]>> {
		// Implement when we can find debuggable applications for iOS.
		return Future.fromResult(null);
	}
}
