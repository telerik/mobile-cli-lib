require("./extensions");

global._ = require("underscore");
global.$injector = require("./yok").injector;

require("colors");
$injector.require("errors", "./common/errors");
$injector.require("fs", "./common/file-system");
$injector.require("logger", "./common/logger");

$injector.require("dispatcher", "./common/dispatchers");
$injector.require("commandDispatcher", "./common/dispatchers");

$injector.require("stringParameter", "./common/command-params");
$injector.require("stringParameterBuilder", "./common/command-params");

$injector.require("commandsService", "./common/services/commands-service");

$injector.require("cancellation", "./common/services/cancellation");
$injector.require("analyticsService", "./common/services/analytics-service");
$injector.require("hooksService", "./common/services/hooks-service");

$injector.require("httpClient", "./common/http-client");
$injector.require("childProcess", "./common/child-process");
$injector.require("prompter", "./common/prompter");
$injector.require("projectHelper", "./common/project-helper");
$injector.require("propertiesParser", "./common/properties-parser");

$injector.requireCommand(["help", "/?"], "./common/commands/help");
$injector.requireCommand("feature-usage-tracking", "./common/commands/analytics");

$injector.require("iOSCore", "./common/mobile/ios/ios-core");
$injector.require("coreFoundation", "./common/mobile/ios/ios-core");
$injector.require("mobileDevice", "./common/mobile/ios/ios-core");
$injector.require("plistService", "./common/mobile/ios/ios-core");

$injector.require("installationProxyClient", "./common/mobile/ios/ios-proxy-services");
$injector.require("notificationProxyClient", "./common/mobile/ios/ios-proxy-services");
$injector.require("houseArrestClient", "./common/mobile/ios/ios-proxy-services");

$injector.require("signal", "./events/signal");
$injector.require("deviceFound", "./common/mobile/mobile-core/device-discovery");
$injector.require("deviceLost", "./common/mobile/mobile-core/device-discovery");

$injector.require("deviceDiscovery", "./common/mobile/mobile-core/device-discovery");
$injector.require("iOSDeviceDiscovery", "./common/mobile/mobile-core/device-discovery");
$injector.require("androidDeviceDiscovery", "./common/mobile/mobile-core/device-discovery");
$injector.require("iOSDevice", "./common/mobile/ios/ios-device");
$injector.require("androidDevice", "./common/mobile/android/android-device");

$injector.require("devicesServices", "./common/mobile/mobile-core/devices-services");
$injector.require("projectNameValidator", "./common/validators/project-name-validator");

$injector.require("androidEmulatorServices", "./common/mobile/android/android-emulator-services");
$injector.require("iOSEmulatorServices", "./common/mobile/ios/ios-emulator-services");
$injector.require("wp8EmulatorServices", "./common/mobile/wp8/wp8-emulator-services");

$injector.require("autoCompletionService", "./common/services/auto-completion-service");
