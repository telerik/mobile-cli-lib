///<reference path=".d.ts"/>

require("./bootstrap");

// TODO: Add real dependencies
$injector.register("staticConfig", {});
$injector.register("config", {});
$injector.register("analyiticsService", {});
module.exports = $injector.publicApi;
