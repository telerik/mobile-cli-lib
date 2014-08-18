global._ = require("underscore");
global.$injector = require("./yok").injector;

require("colors");

$injector.require("errors", "./common/errors");
$injector.require("fs", "./common/file-system");
$injector.require("logger", "./common/logger");

$injector.require("dispatcher", "./common/dispatchers");
$injector.require("commandDispatcher", "./common/dispatchers");

$injector.require("commandsService", "./common/services/commands-service");
$injector.require("cancellation", "./common/services/cancellation");
$injector.require("analyticsService", "./common/services/analytics-service");

$injector.require("httpClient", "./common/http-client");
$injector.require("childProcess", "./common/child-process");
$injector.require("prompter", "./common/prompter");
$injector.require("projectHelper", "./common/project-helper");
$injector.require("propertiesParser", "./common/properties-parser");

$injector.requireCommand(["help", "/?"], "./common/commands/help");
$injector.requireCommand("feature-usage-tracking", "./common/services/analytics-service");
