import { RUNNING_EMULATOR_STATUS, DeviceTypes } from "../constants";

export class EmulatorHelper implements Mobile.IEmulatorHelper {
	public getEmulatorsFromAvailableEmulatorsOutput(availableEmulatorsOutput: Mobile.IListEmulatorsOutput): Mobile.IDeviceInfo[] {
		return <Mobile.IDeviceInfo[]>(_(availableEmulatorsOutput)
			.valuesIn()
			.map((value: Mobile.IAvailableEmulatorsOutput) => value.devices)
			.concat()
			.flatten()
			.value());
	}

	public getErrorsFromAvailableEmulatorsOutput(availableEmulatorsOutput: Mobile.IListEmulatorsOutput): string[] {
		return <string[]>(_(availableEmulatorsOutput)
			.valuesIn()
			.map((value: Mobile.IAvailableEmulatorsOutput) => value.errors)
			.concat()
			.flatten()
			.value());
	}

	public getEmulatorByImageIdentifier(imageIdentifier: string, emulators: Mobile.IDeviceInfo[]): Mobile.IDeviceInfo {
		const imagerIdentifierLowerCase = imageIdentifier.toLowerCase();
		return _.find(emulators, emulator => emulator && emulator.imageIdentifier && emulator.imageIdentifier.toLowerCase() === imagerIdentifierLowerCase);
	}

	public getEmulatorByIdOrName(emulatorIdOrName: string, emulators: Mobile.IDeviceInfo[]): Mobile.IDeviceInfo {
		const emulatorIdOrNameLowerCase = emulatorIdOrName.toLowerCase();
		return _.find(emulators, emulator => emulator && ((emulator.identifier && emulator.identifier.toLowerCase() === emulatorIdOrNameLowerCase) || emulator.displayName.toLowerCase() === emulatorIdOrNameLowerCase));
	}

	public isEmulatorRunning(emulator: Mobile.IDeviceInfo): boolean {
		return emulator && emulator.status === RUNNING_EMULATOR_STATUS;
	}

	public getEmulatorByStartEmulatorOptions(options: Mobile.IStartEmulatorOptions, emulators: Mobile.IDeviceInfo[]): Mobile.IDeviceInfo {
		if (options.emulator) {
			return options.emulator;
		}

		if (options.imageIdentifier) {
			return this.getEmulatorByImageIdentifier(options.imageIdentifier, emulators);
		}

		if (options.emulatorIdOrName) {
			return this.getEmulatorByIdOrName(options.emulatorIdOrName, emulators);
		}

		return null;
	}

	public setRunningAndroidEmulatorProperties(emulatorId: string, emulator: Mobile.IDeviceInfo): void {
		emulator.identifier = emulatorId;
		emulator.status = RUNNING_EMULATOR_STATUS;
		emulator.type = DeviceTypes.Device;
		//emulator.isTablet; // TODO: consider to do this here!!!
	}
}
$injector.register("emulatorHelper", EmulatorHelper);
