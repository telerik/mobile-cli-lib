let qrcode = require("qrcode-generator");

export class QrCodeGenerator implements IQrCodeGenerator {
	// The order is important.
	private static ERROR_CORRECTION_LEVEL = ["L", "M", "Q", "H"];

	// https://en.wikiversity.org/wiki/Reed%E2%80%93Solomon_codes_for_coders/Additional_information
	private static MAX_BLOCK_VERSION = 40;

	constructor(private $staticConfig: Config.IStaticConfig) { }

	public async generateQrCode(data: string): Promise<any> {
		let errorCorrectionLevel = "L";
		let errorCorrectionOffset = _.indexOf(QrCodeGenerator.ERROR_CORRECTION_LEVEL, errorCorrectionLevel);

		// 4 is from the qrcode-generator source code.
		let maxReedSolomonBlockIndex = QrCodeGenerator.MAX_BLOCK_VERSION / 4 - errorCorrectionOffset;

		for (let i = 1; i <= maxReedSolomonBlockIndex; ++i) {
			let qr = qrcode(i, errorCorrectionLevel);
			try {
				qr.addData(data);
				qr.make();
			} catch (ex) {
				let expected = "code length overflow.";
				if (ex.message && ex.message.substr(0, expected.length) === expected) {
					continue;
				} else {
					throw ex;
				}
			}

			return qr;
		}

		// Since the max Reed-Solomon block index was calculated before the for loop and no exception was thrown in it here the only error can be because of long project name.
		// Return null and expect the consumer to take caution in handling this case
		return null;
	}

	public async generateDataUri(data: string): Promise<string> {
		let qr = await this.generateQrCode(data);
		let dataUri: string = null;
		if (qr) {
			let cells = qr.getModuleCount();
			let size = this.$staticConfig.QR_SIZE;
			let cellSize = Math.ceil(size / (cells + 2 * 4 /* margin */));

			let imgTag = qr.createImgTag(cellSize);
			dataUri = imgTag.split('src="')[1].split('"')[0];
		}

		return dataUri;
	}
}

$injector.register("qr", QrCodeGenerator);
