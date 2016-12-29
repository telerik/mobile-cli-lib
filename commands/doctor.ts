import {EOL} from "os";
import future = require("fibers/future");

export class DoctorCommand implements ICommand {

	constructor(private $doctorService: IDoctorService,
		private $logger: ILogger,
		private $staticConfig: Config.IStaticConfig) { }

	public async canExecute(args: string[]): Promise<boolean> {
		return Promise.resolve(true);
	}

	public allowedParameters: ICommandParameter[] = [];

	public async execute(args: string[]): Promise<void> {
			let warningsPrinted = await  this.$doctorService.printWarnings();
			if (warningsPrinted) {
				let client = this.$staticConfig.CLIENT_NAME_ALIAS || this.$staticConfig.CLIENT_NAME;
				this.$logger.out(`When you file an issue, these warnings will help the ${client} team to investigate, identify, and resolve the report.`.bold
					+ EOL + `Please, ignore them if you are not experiencing any issues with ${client}.`.bold + EOL);
			} else {
				this.$logger.out("No issues were detected.".bold);
			}
	}
}

$injector.registerCommand("doctor", DoctorCommand);
