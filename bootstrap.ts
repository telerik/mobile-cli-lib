global._ = require("lodash");
global.$injector = require("./yok").injector;
$injector.require("options", "./options");

require("colors");
$injector.require("errors", "./errors");
$injector.requirePublic("fs", "./file-system");
$injector.require("logger", "./logger");
$injector.require("sysInfo", "./sysinfo");
$injector.require("hostInfo", "./host-info");

$injector.require("dispatcher", "./dispatchers");
$injector.require("commandDispatcher", "./dispatchers");

$injector.require("resources", "./resource-loader");

$injector.require("stringParameter", "./command-params");
$injector.require("stringParameterBuilder", "./command-params");

$injector.require("commandsService", "./services/commands-service");

$injector.require("cancellation", "./services/cancellation");
$injector.require("analyticsService", "./services/analytics-service");
$injector.require("hooksService", "./services/hooks-service");

$injector.require("httpClient", "./http-client");
$injector.require("childProcess", "./child-process");
$injector.require("prompter", "./prompter");
$injector.require("projectHelper", "./project-helper");
$injector.require("pluginVariablesHelper", "./plugin-variables-helper");
$injector.require("propertiesParser", "./properties-parser");

$injector.requireCommand(["help", "/?"], "./commands/help");
$injector.requireCommand("usage-reporting", "./commands/analytics");
$injector.requireCommand("error-reporting", "./commands/analytics");

$injector.requireCommand("dev-post-install", "./commands/post-install");
$injector.requireCommand("autocomplete|*default", "./commands/autocompletion");
$injector.requireCommand("autocomplete|enable", "./commands/autocompletion");
$injector.requireCommand("autocomplete|disable", "./commands/autocompletion");
$injector.requireCommand("autocomplete|status", "./commands/autocompletion");

$injector.requireCommand("device|*list", "./commands/device/list-devices");
$injector.requireCommand("device|android", "./commands/device/list-devices");
$injector.requireCommand("device|ios", "./commands/device/list-devices");

$injector.requireCommand("device|log", "./commands/device/device-log-stream");
$injector.requireCommand("device|run", "./commands/device/run-application");
$injector.requireCommand("device|stop", "./commands/device/stop-application");
$injector.requireCommand("device|list-applications", "./commands/device/list-applications");
$injector.requireCommand("device|uninstall", "./commands/device/uninstall-application");
$injector.requireCommand("device|list-files", "./commands/device/list-files");
$injector.requireCommand("device|get-file", "./commands/device/get-file");
$injector.requireCommand("device|put-file", "./commands/device/put-file");

$injector.require("iOSCore", "./mobile/ios/ios-core");
$injector.require("coreFoundation", "./mobile/ios/ios-core");
$injector.require("mobileDevice", "./mobile/ios/ios-core");
$injector.require("plistService", "./mobile/ios/ios-core");

$injector.require("installationProxyClient", "./mobile/ios/ios-proxy-services");
$injector.require("notificationProxyClient", "./mobile/ios/ios-proxy-services");
$injector.require("houseArrestClient", "./mobile/ios/ios-proxy-services");
$injector.require("gdbServer", "./mobile/ios/ios-core");

$injector.require("deviceFound", "./mobile/mobile-core/device-discovery");
$injector.require("deviceLost", "./mobile/mobile-core/device-discovery");

$injector.require("iTunesValidator", "./validators/iTunes-validator");
$injector.require("deviceDiscovery", "./mobile/mobile-core/device-discovery");
$injector.require("iOSDeviceDiscovery", "./mobile/mobile-core/ios-device-discovery");
$injector.requirePublicClass("devices", "./mobile/mobile-core/devices");
$injector.require("androidDeviceDiscovery", "./mobile/mobile-core/android-device-discovery");
$injector.require("iOSDevice", "./mobile/ios/ios-device");
$injector.require("androidDevice", "./mobile/android/android-device");
$injector.require("logcatHelper", "./mobile/android/logcat-helper");

$injector.require("localToDevicePathDataFactory", "./mobile/local-to-device-path-data-factory");
$injector.require("deviceAppDataFactory", "./mobile/device-app-data/device-app-data-factory");

$injector.require("devicesServices", "./mobile/mobile-core/devices-services");
$injector.require("projectNameValidator", "./validators/project-name-validator");

$injector.require("androidEmulatorServices", "./mobile/android/android-emulator-services");
$injector.require("iOSEmulatorServices", "./mobile/ios/ios-emulator-services");
$injector.require("wp8EmulatorServices", "./mobile/wp8/wp8-emulator-services");

$injector.require("autoCompletionService", "./services/auto-completion-service");
$injector.require("opener", "./opener");
$injector.require("dynamicHelpService", "./services/dynamic-help-service");
$injector.require("microTemplateService", "./services/micro-templating-service");
$injector.require("mobileHelper", "./mobile/mobile-helper");
$injector.require("devicePlatformsConstants", "./mobile/device-platforms-constants");
$injector.require("htmlHelpService", "./services/html-help-service");
$injector.requireCommand("dev-preuninstall", "./commands/preuninstall");
$injector.requireCommand("doctor", "./commands/doctor");

$injector.require("utils", "./utils");
$injector.require("bplistParser", "./bplist-parser");
