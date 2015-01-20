///<reference path="../.d.ts"/>

import Url = require("url");
import Future = require("fibers/future");
import helpers = require("./helpers");
import zlib = require("zlib");
import util = require("util");
import progress = require('progress-stream');
import filesize = require('filesize');

export class HttpClient implements Server.IHttpClient {
	private defaultUserAgent: string;

	constructor(private $logger: ILogger,
		private $staticConfig: Config.IStaticConfig,
		private $config: Config.IConfig) {}

	httpRequest(options: any): IFuture<Server.IResponse> {
		return (() => {
			if (_.isString(options)) {
				options = {
					url: options,
					method: "GET"
				}
			}

			var unmodifiedOptions = _.clone(options);

			if (options.url) {
				var urlParts = Url.parse(options.url);
				if (urlParts.protocol) {
					options.proto = urlParts.protocol.slice(0, -1);
				}
				options.host = urlParts.hostname;
				options.port = urlParts.port;
				options.path = urlParts.path;
				delete options.url;
			}

			var requestProto = options.proto || "http";
			delete options.proto;
			var body = options.body;
			delete options.body;
			var pipeTo = options.pipeTo;
			delete options.pipeTo;

			var proto = this.$config.PROXY_TO_FIDDLER ? "http" : requestProto;
			var http = require(proto);

			options.headers = options.headers || {};
			var headers = options.headers;

			if (this.$config.PROXY_TO_FIDDLER) {
				options.path = requestProto + "://" + options.host + options.path;
				headers.Host = options.host;
				options.host = this.$config.FIDDLER_HOSTNAME;
				options.port = 8888;
			}

			if (!headers.Accept || headers.Accept.indexOf("application/json") < 0) {
				if (headers.Accept) {
					headers.Accept += ", ";
				} else {
					headers.Accept = "";
				}
				headers.Accept += "application/json; charset=UTF-8, */*;q=0.8";
			}

			if (!headers["User-Agent"]) {
				if (!this.defaultUserAgent) {
					//TODO: the user agent client name is also passed explicitly during login and should be kept in sync
					this.defaultUserAgent = util.format("AppBuilderCLI/%s (Node.js %s; %s; %s)",
						this.$staticConfig.version,
						process.versions.node, process.platform, process.arch);
					this.$logger.debug("User-Agent: %s", this.defaultUserAgent);
				}

				headers["User-Agent"] = this.defaultUserAgent;
			}

			if (!headers["Accept-Encoding"]) {
				headers["Accept-Encoding"] = "gzip,deflate";
			}

			var result = new Future<Server.IResponse>();

			this.$logger.trace("httpRequest: %s", util.inspect(options));

			var request = http.request(options, (response: Server.IRequestResponseData) => {
				var data: string[] = [];
				var isRedirect = helpers.isResponseRedirect(response);
				var successful = helpers.isRequestSuccessful(response);
				if (!successful) {
					pipeTo = undefined;
				}

				var responseStream = response;
				switch (response.headers['content-encoding']) {
					case 'gzip':
						responseStream = responseStream.pipe(zlib.createGunzip());
						break;
					case 'deflate':
						responseStream = responseStream.pipe(zlib.createInflate());
						break;
				}

				if (pipeTo) {
					pipeTo.on("finish", () => {
						this.$logger.trace("httpRequest: Piping done. code = %d", response.statusCode.toString());
						if(!result.isResolved()) {
							result.return({
								response: response,
								headers: response.headers
							});
						}
					});

					pipeTo = this.trackDownloadProgress(pipeTo);

					responseStream.pipe(pipeTo);
				} else {
					responseStream.on("data", (chunk: string) => {
						data.push(chunk);
					});

					responseStream.on("end", () => {
						this.$logger.trace("httpRequest: Done. code = %d", response.statusCode.toString());
						var body = data.join("");

						if (successful || isRedirect) {
							if(!result.isResolved()) {
								result.return({
									body: body,
									response: response,
									headers: response.headers
								});
							}
						} else {
							var errorMessage = this.getErrorMessage(response, body);
							var theError: any = new Error(errorMessage);
							theError.response = response;
							theError.body = body;
							result.throw(theError);
						}
					});
				}
			});

			request.on("error", (error: Error) => {
				if(!result.isResolved()) {
					result.throw(error);
				}
			});

			this.$logger.trace("httpRequest: Sending:\n%s", this.$logger.prepare(body));

			if (!body || !body.pipe) {
				request.end(body);
			} else {
				body.pipe(request);
			}

			var response = result.wait();
			if(helpers.isResponseRedirect(response.response)) {
				if (response.response.statusCode == 303) {
					unmodifiedOptions.method = "GET";
				}

				this.$logger.trace("Begin redirected to %s", response.headers.location);
				unmodifiedOptions.url = response.headers.location;
				return this.httpRequest(unmodifiedOptions).wait();
			}

			return response;
		}).future<Server.IResponse>()();
	}

	private trackDownloadProgress(pipeTo: WritableStream): ReadableStream {
		// \r for carriage return doesn't work on windows in node for some reason so we have to use it's hex representation \x1B[0G
		var lastMessageSize = 0,
			carriageReturn = "\x1B[0G",
			timeElapsed = 0;

		var progressStream = progress({ time: 1000 }, (progress: any) => {
			timeElapsed = progress.runtime;

			if (timeElapsed >= 1) {
				this.$logger.write("%s%s", carriageReturn, Array(lastMessageSize + 1).join(' '));

				var message = util.format("%sDownload progress ... %s | %s | %s/s",
					carriageReturn,
						Math.floor(progress.percentage) + '%',
					filesize(progress.transferred),
					filesize(progress.speed));

				this.$logger.write(message);
				lastMessageSize = message.length;
			}
		});

		progressStream.on("finish", () => {
			if (timeElapsed >= 1) {
				this.$logger.out("%s%s%s%s", carriageReturn, Array(lastMessageSize + 1).join(' '), carriageReturn, "Download completed.");
			}
		});

		progressStream.pipe(pipeTo);
		return progressStream;
	}

	private getErrorMessage(response: Server.IRequestResponseData, body: string): string {
		if (response.statusCode === 402) {
			var subscriptionUrl = util.format("%s://%s/appbuilder/account/subscription", this.$config.AB_SERVER_PROTO, this.$config.AB_SERVER);
			return util.format("Your subscription has expired. Go to %s to manage your subscription. Note: After you renew your subscription, " +
				"log out and log back in for the changes to take effect.", subscriptionUrl);
		} else {
			try {
				var err = JSON.parse(body);

				if (_.isString(err)) {
					return err;
				}

				if (err.ExceptionMessage) {
					return err.ExceptionMessage;
				}
				if (err.Message) {
					return err.Message;
				}
			} catch (parsingFailed) {}

			return body;
		}
	}
}
$injector.register("httpClient", HttpClient);