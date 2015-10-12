///<reference path="../.d.ts"/>
"use strict";

import {EOL} from "os";
import codeEntityLib = require("./code-entity");

export class SwaggerCodePrinter {
	private static INDENT_CHAR = "\t";
	private static NEW_LINE_CHAR = EOL;
	private static START_BLOCK_CHAR = "{";
	private static END_BLOCK_CHAR = "}";

	public composeBlock(block: CodeGeneration.IBlock, indentSize: number = 0): string {
		let content = this.getIndentation(indentSize);

		if(block.opener) {
			content += block.opener;
			content += SwaggerCodePrinter.START_BLOCK_CHAR;
			content += SwaggerCodePrinter.NEW_LINE_CHAR;
		}

		_.each(block.codeEntities, (codeEntity: CodeGeneration.ICodeEntity) => {
			if(codeEntity.codeEntityType === codeEntityLib.CodeEntityType.Line) {
				content += this.composeLine(<CodeGeneration.ILine>codeEntity, indentSize + 1);
			} else if(codeEntity.codeEntityType === codeEntityLib.CodeEntityType.Block){
				content += this.composeBlock(<CodeGeneration.IBlock>codeEntity, indentSize + 1);
			}
		});

		if(block.opener) {
			content += this.getIndentation(indentSize);
			content += SwaggerCodePrinter.END_BLOCK_CHAR;
			content += block.endingCharacter ? block.endingCharacter : '';
		}

		content += SwaggerCodePrinter.NEW_LINE_CHAR;

		return content;
	}

	private getIndentation(indentSize: number): string {
		return Array(indentSize).join(SwaggerCodePrinter.INDENT_CHAR);
	}

	private composeLine(line: CodeGeneration.ILine, indentSize: number): string {
		let content = this.getIndentation(indentSize);
		content += line.content;
		content += SwaggerCodePrinter.NEW_LINE_CHAR;

		return content;
	}
}
$injector.register("swaggerCodePrinter", SwaggerCodePrinter);
