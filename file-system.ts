///<reference path="../.d.ts"/>
"use strict";

import fs = require("fs");
import unzip = require("unzip");
import Future = require("fibers/future");
import path = require("path");
import util = require("util");
import rimraf = require("rimraf");
import hostInfo = require("./host-info");

export class FileSystem implements IFileSystem {



	//TODO: try 'archiver' module for zipping
	public zipFiles(zipFile: string, files: string[], zipPathCallback: (path: string) => string): IFuture<void> {
		//we are resolving it here instead of in the constructor, because config has dependency on file system and config shouldn't require logger
		var $logger = $injector.resolve("logger");
		var zipstream = require("zipstream");
		var zip = zipstream.createZip({ level: 9 });
		var outFile = fs.createWriteStream(zipFile);
		zip.pipe(outFile);

		var result = new Future<void>();
		outFile.on("error", (err: Error) => result.throw(err));

		var fileIdx = -1;
		var zipCallback = () => {
			fileIdx++;
			if(fileIdx < files.length) {
				var file = files[fileIdx];

				var relativePath = zipPathCallback(file);
				relativePath = relativePath.replace(/\\/g, "/");
				$logger.trace("zipping as '%s' file '%s'", relativePath, file);

				zip.addFile(
					fs.createReadStream(file),
					{ name: relativePath },
					zipCallback);
			} else {
				outFile.on("finish", () => result.return());

				zip.finalize((bytesWritten: number) => {
					$logger.debug("zipstream: %d bytes written", bytesWritten);
					outFile.end();
				});
			}
		};
		zipCallback();

		return result;
	}

	public unzip(zipFile: string, destinationDir: string, options?: { overwriteExisitingFiles?: boolean; caseSensitive?: boolean}, fileFilters?: string[]): IFuture<void> {
		return (() => {
			var shouldOverwriteFiles = options && options.overwriteExisitingFiles ? options.overwriteExisitingFiles : true;
			var isCaseSensitive = options && options.caseSensitive ? options.caseSensitive : true;
			
			//the wild card symbol at the end is required in order for the -ssc- switch of 7zip to behave properly
			zipFile = isCaseSensitive ? zipFile : zipFile + '*';
			
			var $childProcess = $injector.resolve("$childProcess");
			this.createDirectory(destinationDir).wait();

			var sevenZip = (<Config.IStaticConfig>$injector.resolve("$staticConfig")).sevenZipFilePath;
			var unzipProc = $childProcess.spawn(sevenZip, _.flatten(['x', shouldOverwriteFiles ? "-y" : "-aos", '-o' + destinationDir, isCaseSensitive ? '' : '-ssc-', zipFile, fileFilters || []]),
				{ stdio: "ignore", detached: true });
			this.futureFromEvent(unzipProc, "close").wait();
		}).future<void>()();
	}

	public exists(path: string): IFuture<boolean> {
		var future = new Future<boolean>();
		fs.exists(path, (exists: boolean) => future.return(exists));
		return future;
	}

	public deleteFile(path: string): IFuture<void> {
		var future = new Future<void>();
		fs.unlink(path, (err: any) => {
			if(err && err.code !== "ENOENT") {  // ignore "file doesn't exist" error
				future.throw(err);
			} else {
				future.return();
			}
		});
		return future;
	}

	public deleteDirectory(directory: string): IFuture<void> {
		var future = new Future<void>();
		rimraf(directory, (err) => {
			if(err) {
				future.throw(err);
			} else {
				future.return();
			}
		});

		return future;
	}

	public getFileSize(path: string): IFuture<number> {
		return ((): number => {
			var stat = this.getFsStats(path).wait();
			return stat.size;
		}).future<number>()();
	}

	public futureFromEvent(eventEmitter: any, event: string): IFuture<any> {
		var future = new Future();
		eventEmitter.once(event, () => {
			var args = _.toArray(arguments);

			if(event === "error") {
				var err = <Error>args[0];
				future.throw(err);
				return;
			}

			switch(args.length) {
				case 0:
					future.return();
					break;
				case 1:
					future.return(args[0]);
					break;
				default:
					future.return(args);
					break;
			}
		});
		return future;
	}

	public createDirectory(path: string): IFuture<void> {
		var future = new Future<void>();
		(<any> require("mkdirp"))(path, (err: Error) => {
			if(err) {
				future.throw(err);
			} else {
				future.return();
			}
		});
		return future;
	}

	public readDirectory(path: string): IFuture<string[]> {
		var future = new Future<string[]>();
		fs.readdir(path, (err: Error, files: string[]) => {
			if(err) {
				future.throw(err);
			} else {
				future.return(files);
			}
		});
		return future;
	}

	public readFile(filename: string): IFuture<NodeBuffer> {
		var future = new Future<NodeBuffer>();
		fs.readFile(filename, (err: Error, data: NodeBuffer) => {
			if(err) {
				future.throw(err);
			} else {
				future.return(data);
			}
		});
		return future;
	}

	public readText(filename: string, options?: any): IFuture<string> {
		options = options || { encoding: "utf8" };
		if (_.isString(options)) {
			options = { encoding: options }
		}
		if (!options.encoding) {
			options.encoding = "utf8";
		}

		var future = new Future<string>();
		fs.readFile(filename, options, (err: Error, data: string) => {
			if(err) {
				future.throw(err);
			} else {
				future.return(data);
			}
		});
		return future;
	}

	public readJson(filename: string, encoding?: string): IFuture<any> {
		return (() => {
			var data = this.readText(filename, encoding).wait();
			if(data) {
				return JSON.parse(data);
			}
			return null;
		}).future()();
	}

	public writeFile(filename: string, data: any, encoding?: string): IFuture<void> {
		return (() => {
			this.createDirectory(path.dirname(filename)).wait();
			var future = new Future<void>();
			fs.writeFile(filename, data, { encoding: encoding }, (err: Error) => {
				if(err) {
					future.throw(err);
				} else {
					future.return();
				}
			});
			future.wait();
		}).future<void>()();
	}

	public writeJson(filename: string, data: any, space: string = "\t", encoding?: string): IFuture<void> {
		return this.writeFile(filename, JSON.stringify(data, null, space), encoding);
	}

	public copyFile(sourceFileName: string, destinationFileName: string): IFuture<void> {
		return (() => {
			this.createDirectory(path.dirname(destinationFileName)).wait();
			var source = this.createReadStream(sourceFileName);
			var target = this.createWriteStream(destinationFileName);
			source.pipe(target);
			this.futureFromEvent(target, "finish").wait();
		}).future<void>()();
	}

	public createReadStream(path: string, options?: {
		flags?: string;
		encoding?: string;
		fd?: string;
		mode?: number;
		bufferSize?: number;
	}): any {
		return fs.createReadStream(path, options);
	}

	public createWriteStream(path: string, options?: {
		flags?: string;
		encoding?: string;
		string?: string;
	}): any {
		return fs.createWriteStream(path, options);
	}

	public chmod(path: string, mode: any): IFuture<void> {
		var future = new Future<void>();
		fs.chmod(path, mode, (err: Error) => {
			if(err) {
				future.throw(err);
			} else {
				future.return();
			}
		});
		return future;
	}

	public getFsStats(path: string): IFuture<fs.Stats> {
		var future = new Future<fs.Stats>();
		fs.stat(path, (err: Error, data: fs.Stats) => {
			if(err) {
				future.throw(err);
			} else {
				future.return(data);
			}
		});
		return future;
	}

	public getUniqueFileName(baseName: string): IFuture<string> {
		return ((): string => {
			if(!this.exists(baseName).wait()) {
				return baseName;
			}
			var extension = path.extname(baseName);
			var prefix = path.basename(baseName, extension);

			for(var i = 2; ; ++i) {
				var numberedName = prefix + i + extension;
				if(!this.exists(numberedName).wait()) {
					return numberedName;
				}
			}
		}).future<string>()();
	}

	public isEmptyDir(directoryPath: string): IFuture<boolean> {
		return (() => {
			var directoryContent = this.readDirectory(directoryPath).wait();
			return directoryContent.length === 0;
		}).future<boolean>()();
	}

	public ensureDirectoryExists(directoryPath: string): IFuture<void> {
		return (() => {
			if(!this.exists(directoryPath).wait()) {
				this.createDirectory(directoryPath).wait();
			}
		}).future<void>()();
	}

	public rename(oldPath: string, newPath: string): IFuture<void> {
		var future = new Future<void>();
		fs.rename(oldPath, newPath, (err: Error) => {
			if(err) {
				future.throw(err);
			} else {
				future.return();
			}
		});

		return future;
	}

	public symlink(sourcePath: string, destinationPath: string, type?: string): IFuture<void> {
		var future = new Future<void>();
		fs.symlink(sourcePath, destinationPath, type, (err: Error) => {
			if(err) {
				future.throw(err);
			} else {
				future.return();
			}
		});
		return future;
	}

	public closeStream(stream: any): IFuture<void> {
		var future = new Future<void>();
		stream.close((err: Error, data: any) => {
			if(err) {
				future.throw(err);
			} else {
				future.return();
			}
		});
		return future;
	}

	public setCurrentUserAsOwner(path: string, owner: string): IFuture<void> {
		return (() => {
			if(!hostInfo.isWindows()) {
				var $childProcess = $injector.resolve("$childProcess");

				var chown = $childProcess.spawn('chown', ['-R', owner, path],
					{ stdio: "ignore", detached: true });
				this.futureFromEvent(chown, "close").wait();
			}
			// nothing to do on Windows, as chown does not work on this platform
		}).future<void>()();
	}
}
$injector.register("fs", FileSystem);
