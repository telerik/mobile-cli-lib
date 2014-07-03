global._ = require("underscore");
global.$injector = require("./yok").injector;

$injector.require("errors", "./common/errors");
$injector.require("fs", "./common/file-system");
$injector.require("logger", "./common/logger");

$injector.require("dispatcher", "./common/dispatchers");
$injector.require("commandDispatcher", "./common/dispatchers");
$injector.require("commandsService", "./common/services/commands-service");
$injector.require("cancellation", "./common/services/cancellation");
