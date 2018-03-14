export class DoctorCommand implements ICommand {

	constructor(private $doctorService: IDoctorService) { }

	public allowedParameters: ICommandParameter[] = [];

	public execute(args: string[]): Promise<void> {
		return this.$doctorService.printWarnings();
	}
}

$injector.registerCommand("doctor", DoctorCommand);
