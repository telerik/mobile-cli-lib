import { IOSDeviceLib as IOSDeviceLibModule } from "ios-device-lib";
import { cache } from "../../../decorators";
import assert = require("assert");

export class IOSDeviceOperations implements IIOSDeviceOperations, IDisposable {
	public isInitialized: boolean;
	public shouldDispose: boolean;
	private deviceLib: IOSDeviceLib.IOSDeviceLib;

	constructor(private $logger: ILogger) {
		this.isInitialized = false;
		this.shouldDispose = true;
	}

	public async install(ipaPath: string, deviceIdentifiers: string[], errorHandler: DeviceOperationErrorHandler): Promise<IOSDeviceResponse> {
		this.assertIsInitialized();
		this.$logger.trace(`Installing ${ipaPath} on devices with identifiers: ${deviceIdentifiers}.`);
		return await this.getMultipleResults<IOSDeviceLib.IDeviceResponse>(() => this.deviceLib.install(ipaPath, deviceIdentifiers), errorHandler);
	}

	public async uninstall(appIdentifier: string, deviceIdentifiers: string[], errorHandler: DeviceOperationErrorHandler): Promise<IOSDeviceResponse> {
		this.assertIsInitialized();
		this.$logger.trace(`Uninstalling ${appIdentifier} from devices with identifiers: ${deviceIdentifiers}.`);
		return await this.getMultipleResults<IOSDeviceLib.IDeviceResponse>(() => this.deviceLib.uninstall(appIdentifier, deviceIdentifiers), errorHandler);
	}

	@cache()
	public async startLookingForDevices(deviceFoundCallback: DeviceInfoCallback, deviceLostCallback: DeviceInfoCallback): Promise<void> {
		this.$logger.trace("Starting to look for iOS devices.");
		this.isInitialized = true;
		if (!this.deviceLib) {
			this.deviceLib = new IOSDeviceLibModule(deviceFoundCallback, deviceLostCallback);

			// We need this because we need to make sure that we have devices.
			await new Promise((resolve, reject) => {
				setTimeout(resolve, 1500);
			});
		}
	}

	public startDeviceLog(deviceIdentifier: string, printLogFunction: (data: string) => void): void {
		this.assertIsInitialized();
		this.setShouldDispose(false);

		this.$logger.trace(`Printing device log for device with identifier: ${deviceIdentifier}.`);

		this.deviceLib.on("deviceLogData", (response: IOSDeviceLib.IDeviceLogData) => {
			printLogFunction(response.message);
		});

		this.deviceLib.startDeviceLog([deviceIdentifier]);
	}

	public async apps(deviceIdentifiers: string[], errorHandler?: DeviceOperationErrorHandler): Promise<IOSDeviceAppInfo> {
		this.assertIsInitialized();
		this.$logger.trace(`Getting applications information for devices with identifiers: ${deviceIdentifiers}`);
		return this.getMultipleResults(() => this.deviceLib.apps(deviceIdentifiers), errorHandler);
	}

	public async listDirectory(listArray: IOSDeviceLib.IReadOperationData[], errorHandler?: DeviceOperationErrorHandler): Promise<IOSDeviceMultipleResponse> {
		this.assertIsInitialized();

		_.each(listArray, l => {
			this.$logger.trace(`Listing directory: ${l.path} for application ${l.appId} on device with identifier: ${l.deviceId}.`);
		});

		return this.getMultipleResults<IOSDeviceLib.IDeviceMultipleResponse>(() => this.deviceLib.list(listArray), errorHandler);
	}

	public async readFiles(deviceFilePaths: IOSDeviceLib.IReadOperationData[], errorHandler?: DeviceOperationErrorHandler): Promise<IOSDeviceResponse> {
		this.assertIsInitialized();

		_.each(deviceFilePaths, p => {
			this.$logger.trace(`Reading file: ${p.path} from application ${p.appId} on device with identifier: ${p.deviceId}.`);
		});

		return this.getMultipleResults<IOSDeviceLib.IDeviceResponse>(() => this.deviceLib.read(deviceFilePaths), errorHandler);
	}

	public async downloadFiles(deviceFilePaths: IOSDeviceLib.IFileOperationData[], errorHandler?: DeviceOperationErrorHandler): Promise<IOSDeviceResponse> {
		this.assertIsInitialized();

		_.each(deviceFilePaths, d => {
			this.$logger.trace(`Downloading file: ${d.source} from application ${d.appId} on device with identifier: ${d.deviceId} to ${d.destination}.`);
		});

		return this.getMultipleResults<IOSDeviceLib.IDeviceResponse>(() => this.deviceLib.download(deviceFilePaths), errorHandler);
	}

	public uploadFiles(files: IOSDeviceLib.IUploadFilesData[], errorHandler?: DeviceOperationErrorHandler): Promise<IOSDeviceResponse> {
		this.assertIsInitialized();

		_.each(files, f => {
			this.$logger.trace("Uploading files:");
			this.$logger.trace(f.files);
			this.$logger.trace(`For application ${f.appId} on device with identifier: ${f.deviceId}.`);
		});

		return this.getMultipleResults<IOSDeviceLib.IDeviceResponse>(() => this.deviceLib.upload(files), errorHandler);
	}

	public async deleteFiles(deleteArray: IOSDeviceLib.IDeleteFileData[], errorHandler?: DeviceOperationErrorHandler): Promise<IOSDeviceResponse> {
		this.assertIsInitialized();

		_.each(deleteArray, d => {
			this.$logger.trace(`Deleting file: ${d.destination} from application ${d.appId} on device with identifier: ${d.deviceId}.`);
		});

		return this.getMultipleResults<IOSDeviceLib.IDeviceResponse>(() => this.deviceLib.delete(deleteArray), errorHandler);
	}

	public async start(startArray: IOSDeviceLib.IDdiApplicationData[], errorHandler?: DeviceOperationErrorHandler): Promise<IOSDeviceResponse> {
		this.assertIsInitialized();

		_.each(startArray, s => {
			this.$logger.trace(`Starting application ${s.appId} on device with identifier: ${s.deviceId}.`);
		});

		return this.getMultipleResults<IOSDeviceLib.IDeviceResponse>(() => this.deviceLib.start(startArray), errorHandler);
	}

	public async stop(stopArray: IOSDeviceLib.IDdiApplicationData[], errorHandler?: DeviceOperationErrorHandler): Promise<IOSDeviceResponse> {
		this.assertIsInitialized();

		_.each(stopArray, s => {
			this.$logger.trace(`Stopping application ${s.appId} on device with identifier: ${s.deviceId}.`);
		});

		return this.getMultipleResults<IOSDeviceLib.IDeviceResponse>(() => this.deviceLib.start(stopArray), errorHandler);
	}

	public dispose(signal?: string): void {
		// We need to check if we should dispose the device lib.
		// For example we do not want to dispose it when we start printing the device logs.
		if (this.shouldDispose && this.deviceLib) {
			this.deviceLib.removeAllListeners();
			this.deviceLib.dispose(signal);
			this.$logger.trace("IOSDeviceOperations disposed.");
		}
	}

	public async notify(notifyArray: IOSDeviceLib.INotifyData[], errorHandler?: DeviceOperationErrorHandler): Promise<IOSDeviceResponse> {
		this.assertIsInitialized();

		_.each(notifyArray, n => {
			this.$logger.trace(`Sending notification ${n.notificationName} to device with identifier: ${n.deviceId}`);
		});

		return this.getMultipleResults<IOSDeviceLib.IDeviceResponse>(() => this.deviceLib.notify(notifyArray), errorHandler);
	}

	public async connectToPort(connectToPortArray: IOSDeviceLib.IConnectToPortData[], errorHandler?: DeviceOperationErrorHandler): Promise<IOSDeviceResponse> {
		this.assertIsInitialized();

		_.each(connectToPortArray, c => {
			this.$logger.trace(`Connecting to port ${c.port} on device with identifier: ${c.deviceId}`);
		});

		return this.getMultipleResults<IOSDeviceLib.IDeviceResponse>(() => this.deviceLib.connectToPort(connectToPortArray), errorHandler);
	}

	public setShouldDispose(shouldDispose: boolean): void {
		this.shouldDispose = shouldDispose;
	}

	private async getMultipleResults<T>(getPromisesMethod: () => Promise<T>[], errorHandler?: DeviceOperationErrorHandler): Promise<IDictionary<T[]>> {
		const result: T[] = [];
		const promises = getPromisesMethod();

		for (let promise of promises) {
			if (errorHandler) {
				try {
					result.push(await promise);
				} catch (err) {
					this.$logger.trace(`Error while executing ios device operation: ${err.message} with code: ${err.code}`);
					errorHandler(err);
				}
			} else {
				result.push(await promise);
			}
		}

		return _.groupBy(result, r => (<any>r).deviceId);
	}

	private assertIsInitialized(): void {
		assert.ok(this.isInitialized, "iOS device operations not initialized.");
	}
}

$injector.register("iosDeviceOperations", IOSDeviceOperations);
