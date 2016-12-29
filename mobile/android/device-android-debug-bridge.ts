import {AndroidDebugBridge} from "./android-debug-bridge";

interface IComposeCommandResult {
	command: string;
	args: string[];
}

export class DeviceAndroidDebugBridge extends AndroidDebugBridge implements Mobile.IDeviceAndroidDebugBridge {
	constructor(private identifier: string,
		protected $childProcess: IChildProcess,
		protected $errors: IErrors,
		protected $logger: ILogger,
		protected $staticConfig: Config.IStaticConfig,
		protected $androidDebugBridgeResultHandler: Mobile.IAndroidDebugBridgeResultHandler) {
		super($childProcess, $errors, $logger, $staticConfig, $androidDebugBridgeResultHandler);
	}

	public executeShellCommand(args: string[], options?: Mobile.IAndroidDebugBridgeCommandOptions): IFuture<any> {
		args.unshift("shell");
		return super.executeCommand(args, options);
	}

	public async sendBroadcastToDevice(action: string, extras?: IStringDictionary): Promise<number> {
			extras = extras || {};
			let broadcastCommand = ["am", "broadcast", "-a", `${action}`];
			_.each(extras, (value, key) => broadcastCommand.push("-e", key, value));

			let result = await  this.executeShellCommand(broadcastCommand);
			this.$logger.trace(`Broadcast result ${result} from ${broadcastCommand}`);

			let match = result.match(/Broadcast completed: result=(\d+)/);
			if (match) {
				return +match[1];
			}

			this.$errors.failWithoutHelp("Unable to broadcast to android device:\n%s", result);
	}

	protected composeCommand(params: string[]): IFuture<IComposeCommandResult> {
		return super.composeCommand(params, this.identifier);
	}
}
