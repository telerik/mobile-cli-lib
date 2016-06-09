import { AndroidLiveSyncService } from "../../../mobile/android/android-livesync-service";
import * as path from "path";
import * as helpers from "../../../helpers";

export class AppBuilderAndroidLiveSyncService extends AndroidLiveSyncService implements IPlatformLiveSyncService {
	constructor(private _device: Mobile.IAndroidDevice,
	 	$fs: IFileSystem,
		$mobileHelper: Mobile.IMobileHelper,
		private $options: ICommonOptions) {
			super(_device, $fs, $mobileHelper);
		}

	public refreshApplication(deviceAppData: Mobile.IDeviceAppData): IFuture<void> {
		return (() => {
			let commands = [ this.liveSyncCommands.SyncFilesCommand() ];
			if(this.$options.watch || this.$options.file) {
				commands.push(this.liveSyncCommands.RefreshCurrentViewCommand());
			} else {
				commands.push(this.liveSyncCommands.ReloadStartViewCommand());
			}

			this.livesync(deviceAppData.appIdentifier, deviceAppData.deviceProjectRootPath, commands).wait();
		}).future<void>()();
	}

	public removeFiles(appIdentifier: string, localToDevicePaths: Mobile.ILocalToDevicePathData[]): IFuture<void> {
		return (() => {
			if (localToDevicePaths && localToDevicePaths.length) {
				let deviceProjectRootPath = localToDevicePaths[0].deviceProjectRootPath;
				let commands =_.map(localToDevicePaths, ldp => {

					let relativePath = path.relative(deviceProjectRootPath, ldp.getDevicePath()),
						unixPath = helpers.fromWindowsRelativePathToUnix(relativePath);

					return this.liveSyncCommands.DeleteFile(unixPath);
				});
				this.livesync(appIdentifier, deviceProjectRootPath, commands).wait();
			}
		}).future<void>()();
	}
}
$injector.register("androidLiveSyncServiceLocator", {factory: AppBuilderAndroidLiveSyncService});
