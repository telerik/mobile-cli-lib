import * as path from "path";
import * as ref from "ref";
import * as ffi from "ffi";
import * as struct from "ref-struct";
import * as bufferpack from "bufferpack";
import * as plistlib from "plistlib";
import * as plist from "plist";
import * as helpers from "../../../helpers";
import * as net from "net";
import * as util from "util";
import Future = require("fibers/future");
import * as bplistParser from "bplist-parser";
import * as string_decoder from "string_decoder";
import * as stream from "stream";
import * as assert from "assert";
import { EOL } from "os";
import * as fiberBootstrap from "../../../fiber-bootstrap";

export class CoreTypes {
	public static pointerSize = ref.types.size_t.size;
	public static voidPtr = ref.refType(ref.types.void);
	public static intPtr = ref.refType(ref.types.int);
	public static uintPtr = ref.refType(ref.types.uint);
	public static charPtr = ref.refType(ref.types.char);
	public static ptrToVoidPtr = ref.refType(ref.refType(ref.types.void));
	public static uintType = ref.types.uint;
	public static uint32Type = ref.types.uint32;
	public static intType = ref.types.int;
	public static longType = ref.types.long;
	public static boolType = ref.types.bool;
	public static doubleType = ref.types.double;

	public static am_device_p = CoreTypes.voidPtr;
	public static cfDictionaryRef = CoreTypes.voidPtr;
	public static cfDataRef = CoreTypes.voidPtr;
	public static cfStringRef = CoreTypes.voidPtr;
	public static afcConnectionRef = CoreTypes.voidPtr;
	public static afcFileRef = ref.types.uint64;
	public static afcDirectoryRef = CoreTypes.voidPtr;
	public static afcError = ref.types.uint32;
	public static amDeviceRef = CoreTypes.voidPtr;
	public static amDeviceNotificationRef = CoreTypes.voidPtr;
	public static cfTimeInterval = ref.types.double;
	public static kCFPropertyListXMLFormat_v1_0 = 100;
	public static kCFPropertyListBinaryFormat_v1_0 = 200;
	public static kCFPropertyListImmutable = 0;

	public static am_device_notification = struct({
		unknown0: ref.types.uint32,
		unknown1: ref.types.uint32,
		unknown2: ref.types.uint32,
		callback: CoreTypes.voidPtr,
		cookie: ref.types.uint32
	});

	public static am_device_notification_callback_info = struct({
		dev: CoreTypes.am_device_p,
		msg: ref.types.uint,
		subscription: ref.refType(CoreTypes.am_device_notification)
	});

	public static am_device_notification_callback = ffi.Function("void", [ref.refType(CoreTypes.am_device_notification_callback_info), CoreTypes.voidPtr]);
	public static am_device_install_application_callback = ffi.Function("void", [CoreTypes.cfDictionaryRef, CoreTypes.voidPtr]);
	public static am_device_mount_image_callback = ffi.Function("void", [CoreTypes.voidPtr, CoreTypes.intType]);
	public static cf_run_loop_timer_callback = ffi.Function("void", [CoreTypes.voidPtr, CoreTypes.voidPtr]);
}

class IOSCore implements Mobile.IiOSCore {

	constructor(private $hostInfo: IHostInfo) {
		this.adjustDllSearchPath();
	}

	private cfDictionaryKeyCallBacks = struct({
		version: CoreTypes.uintType,
		retain: CoreTypes.voidPtr,
		release: CoreTypes.voidPtr,
		copyDescription: CoreTypes.voidPtr,
		equal: CoreTypes.voidPtr,
		hash: CoreTypes.voidPtr
	});

	private cfDictionaryValueCallBacks = struct({
		version: CoreTypes.uintType,
		retain: CoreTypes.voidPtr,
		release: CoreTypes.voidPtr,
		copyDescription: CoreTypes.voidPtr,
		equal: CoreTypes.voidPtr
	});

	public static kCFStringEncodingUTF8 = 0x08000100;

	private get CoreFoundationDir(): string {
		if (this.$hostInfo.isWindows) {
			return path.join(this.CommonProgramFilesPath, "Apple", "Apple Application Support");
		} else if (this.$hostInfo.isDarwin) {
			return "/System/Library/Frameworks/CoreFoundation.framework/CoreFoundation";
		}

		return null;
	}

	private get MobileDeviceDir(): string {
		if (this.$hostInfo.isWindows) {
			return path.join(this.CommonProgramFilesPath, "Apple", "Mobile Device Support");
		} else if (this.$hostInfo.isDarwin) {
			return "/System/Library/PrivateFrameworks/MobileDevice.framework/MobileDevice";
		}

		return null;
	}

	private get CommonProgramFilesPath(): string {
		return process.env.CommonProgramFiles;
	}

	private getForeignPointer(lib: ffi.DynamicLibrary, name: string, type: ref.Type): NodeBuffer {
		let pointer = lib.get(name);
		pointer.type = ref.refType(type);
		return pointer;
	}

	private adjustDllSearchPath(): void {
		if (this.$hostInfo.isWindows) {
			process.env.PATH = this.CoreFoundationDir + ";" + process.env.PATH;
			process.env.PATH += ";" + this.MobileDeviceDir;
		}
	}

	public getCoreFoundationLibrary(): { [key: string]: any } {
		let coreFoundationDll = this.$hostInfo.isWindows ? path.join(this.CoreFoundationDir, "CoreFoundation.dll") : this.CoreFoundationDir;
		let lib = ffi.DynamicLibrary(coreFoundationDll);

		return {
			"CFRunLoopRun": ffi.ForeignFunction(lib.get("CFRunLoopRun"), "void", []),
			"CFRunLoopStop": ffi.ForeignFunction(lib.get("CFRunLoopStop"), "void", [CoreTypes.voidPtr]),
			"CFRunLoopGetCurrent": ffi.ForeignFunction(lib.get("CFRunLoopGetCurrent"), CoreTypes.voidPtr, []),
			"CFStringCreateWithCString": ffi.ForeignFunction(lib.get("CFStringCreateWithCString"), CoreTypes.cfStringRef, [CoreTypes.voidPtr, "string", "uint"]),
			"CFDictionaryGetValue": ffi.ForeignFunction(lib.get("CFDictionaryGetValue"), CoreTypes.voidPtr, [CoreTypes.cfDictionaryRef, CoreTypes.cfStringRef]),
			"CFNumberGetValue": ffi.ForeignFunction(lib.get("CFNumberGetValue"), CoreTypes.boolType, [CoreTypes.voidPtr, "uint", CoreTypes.voidPtr]),
			"CFStringGetCStringPtr": ffi.ForeignFunction(lib.get("CFStringGetCStringPtr"), CoreTypes.charPtr, [CoreTypes.cfStringRef, "uint"]),
			"CFStringGetCString": ffi.ForeignFunction(lib.get("CFStringGetCString"), CoreTypes.boolType, [CoreTypes.cfStringRef, CoreTypes.charPtr, "uint", "uint"]),
			"CFStringGetLength": ffi.ForeignFunction(lib.get("CFStringGetLength"), "ulong", [CoreTypes.cfStringRef]),
			"CFDictionaryGetCount": ffi.ForeignFunction(lib.get("CFDictionaryGetCount"), CoreTypes.intType, [CoreTypes.cfDictionaryRef]),
			"CFDictionaryGetKeysAndValues": ffi.ForeignFunction(lib.get("CFDictionaryGetKeysAndValues"), "void", [CoreTypes.cfDictionaryRef, CoreTypes.ptrToVoidPtr, CoreTypes.ptrToVoidPtr]),
			"CFDictionaryCreate": ffi.ForeignFunction(lib.get("CFDictionaryCreate"), CoreTypes.cfDictionaryRef, [CoreTypes.voidPtr, CoreTypes.ptrToVoidPtr, CoreTypes.ptrToVoidPtr, "int", ref.refType(this.cfDictionaryKeyCallBacks), ref.refType(this.cfDictionaryValueCallBacks)]),
			"kCFTypeDictionaryKeyCallBacks": lib.get("kCFTypeDictionaryKeyCallBacks"),
			"kCFTypeDictionaryValueCallBacks": lib.get("kCFTypeDictionaryValueCallBacks"),
			"CFRunLoopRunInMode": ffi.ForeignFunction(lib.get("CFRunLoopRunInMode"), CoreTypes.intType, [CoreTypes.cfStringRef, CoreTypes.cfTimeInterval, CoreTypes.boolType]),
			"kCFRunLoopDefaultMode": this.getForeignPointer(lib, "kCFRunLoopDefaultMode", ref.types.void),
			"kCFRunLoopCommonModes": this.getForeignPointer(lib, "kCFRunLoopCommonModes", ref.types.void),
			"CFRunLoopTimerCreate": ffi.ForeignFunction(lib.get("CFRunLoopTimerCreate"), CoreTypes.voidPtr, [CoreTypes.voidPtr, CoreTypes.doubleType, CoreTypes.doubleType, CoreTypes.uintType, CoreTypes.uintType, CoreTypes.cf_run_loop_timer_callback, CoreTypes.voidPtr]),
			"CFRunLoopAddTimer": ffi.ForeignFunction(lib.get("CFRunLoopAddTimer"), "void", [CoreTypes.voidPtr, CoreTypes.voidPtr, CoreTypes.cfStringRef]),
			"CFRunLoopRemoveTimer": ffi.ForeignFunction(lib.get("CFRunLoopRemoveTimer"), "void", [CoreTypes.voidPtr, CoreTypes.voidPtr, CoreTypes.cfStringRef]),
			"CFAbsoluteTimeGetCurrent": ffi.ForeignFunction(lib.get("CFAbsoluteTimeGetCurrent"), CoreTypes.doubleType, []),
			"CFPropertyListCreateData": ffi.ForeignFunction(lib.get("CFPropertyListCreateData"), CoreTypes.voidPtr, [CoreTypes.voidPtr, CoreTypes.voidPtr, ref.types.long, ref.types.ulong, CoreTypes.voidPtr]),
			"CFPropertyListCreateWithData": ffi.ForeignFunction(lib.get("CFPropertyListCreateWithData"), CoreTypes.voidPtr, [CoreTypes.voidPtr, CoreTypes.voidPtr, ref.types.ulong, ref.refType(ref.types.long), CoreTypes.voidPtr]),
			"CFGetTypeID": ffi.ForeignFunction(lib.get("CFGetTypeID"), ref.types.long, [CoreTypes.voidPtr]),
			"CFStringGetTypeID": ffi.ForeignFunction(lib.get("CFStringGetTypeID"), ref.types.long, []),
			"CFDictionaryGetTypeID": ffi.ForeignFunction(lib.get("CFDictionaryGetTypeID"), ref.types.long, []),
			"CFDataGetTypeID": ffi.ForeignFunction(lib.get("CFDataGetTypeID"), ref.types.long, []),
			"CFNumberGetTypeID": ffi.ForeignFunction(lib.get("CFNumberGetTypeID"), ref.types.long, []),
			"CFBooleanGetTypeID": ffi.ForeignFunction(lib.get("CFBooleanGetTypeID"), ref.types.long, []),
			"CFArrayGetTypeID": ffi.ForeignFunction(lib.get("CFArrayGetTypeID"), ref.types.long, []),
			"CFDateGetTypeID": ffi.ForeignFunction(lib.get("CFDateGetTypeID"), ref.types.long, []),
			"CFSetGetTypeID": ffi.ForeignFunction(lib.get("CFSetGetTypeID"), ref.types.long, []),
			"CFDataGetBytePtr": ffi.ForeignFunction(lib.get("CFDataGetBytePtr"), ref.refType(ref.types.uint8), [CoreTypes.voidPtr]),
			"CFDataGetLength": ffi.ForeignFunction(lib.get("CFDataGetLength"), ref.types.long, [CoreTypes.voidPtr]),
			"CFDataCreate": ffi.ForeignFunction(lib.get("CFDataCreate"), CoreTypes.voidPtr, [CoreTypes.voidPtr, CoreTypes.voidPtr, ref.types.long]),
			"CFStringGetMaximumSizeForEncoding": ffi.ForeignFunction(lib.get("CFStringGetMaximumSizeForEncoding"), CoreTypes.intType, [CoreTypes.intType, CoreTypes.uint32Type])
		};
	}

	public getMobileDeviceLibrary(): { [key: string]: any } {

		let mobileDeviceDll = this.$hostInfo.isWindows ? path.join(this.MobileDeviceDir, "MobileDevice.dll") : this.MobileDeviceDir;
		let lib = ffi.DynamicLibrary(mobileDeviceDll);

		return {
			"AMDeviceNotificationSubscribe": ffi.ForeignFunction(lib.get("AMDeviceNotificationSubscribe"), "uint", [CoreTypes.am_device_notification_callback, "uint", "uint", "uint", CoreTypes.ptrToVoidPtr]),
			"AMDeviceConnect": ffi.ForeignFunction(lib.get("AMDeviceConnect"), "uint", [CoreTypes.am_device_p]),
			"AMDeviceIsPaired": ffi.ForeignFunction(lib.get("AMDeviceIsPaired"), "uint", [CoreTypes.am_device_p]),
			"AMDevicePair": ffi.ForeignFunction(lib.get("AMDevicePair"), "uint", [CoreTypes.am_device_p]),
			"AMDeviceValidatePairing": ffi.ForeignFunction(lib.get("AMDeviceValidatePairing"), "uint", [CoreTypes.am_device_p]),
			"AMDeviceStartSession": ffi.ForeignFunction(lib.get("AMDeviceStartSession"), "uint", [CoreTypes.am_device_p]),
			"AMDeviceStopSession": ffi.ForeignFunction(lib.get("AMDeviceStopSession"), "uint", [CoreTypes.am_device_p]),
			"AMDeviceDisconnect": ffi.ForeignFunction(lib.get("AMDeviceDisconnect"), "uint", [CoreTypes.am_device_p]),
			"AMDeviceStartService": ffi.ForeignFunction(lib.get("AMDeviceStartService"), "uint", [CoreTypes.am_device_p, CoreTypes.cfStringRef, CoreTypes.intPtr, CoreTypes.voidPtr]),
			"AMDeviceTransferApplication": ffi.ForeignFunction(lib.get("AMDeviceTransferApplication"), "uint", ["int", CoreTypes.cfStringRef, CoreTypes.cfDictionaryRef, CoreTypes.am_device_install_application_callback, CoreTypes.voidPtr]),
			"AMDeviceInstallApplication": ffi.ForeignFunction(lib.get("AMDeviceInstallApplication"), "uint", ["int", CoreTypes.cfStringRef, CoreTypes.cfDictionaryRef, CoreTypes.am_device_install_application_callback, CoreTypes.voidPtr]),
			"AMDeviceLookupApplications": ffi.ForeignFunction(lib.get("AMDeviceLookupApplications"), CoreTypes.uintType, [CoreTypes.am_device_p, CoreTypes.uintType, ref.refType(CoreTypes.cfDictionaryRef)]),
			"AMDeviceUninstallApplication": ffi.ForeignFunction(lib.get("AMDeviceUninstallApplication"), "uint", ["int", CoreTypes.cfStringRef, CoreTypes.cfDictionaryRef, CoreTypes.am_device_install_application_callback, CoreTypes.voidPtr]),
			"AMDeviceStartHouseArrestService": ffi.ForeignFunction(lib.get("AMDeviceStartHouseArrestService"), CoreTypes.intType, [CoreTypes.am_device_p, CoreTypes.cfStringRef, CoreTypes.voidPtr, CoreTypes.intPtr, CoreTypes.voidPtr]),
			"AFCConnectionOpen": ffi.ForeignFunction(lib.get("AFCConnectionOpen"), "uint", ["int", "uint", ref.refType(CoreTypes.afcConnectionRef)]),
			"AFCConnectionClose": ffi.ForeignFunction(lib.get("AFCConnectionClose"), "uint", [CoreTypes.afcConnectionRef]),
			"AFCDirectoryCreate": ffi.ForeignFunction(lib.get("AFCDirectoryCreate"), "uint", [CoreTypes.afcConnectionRef, "string"]),
			"AFCFileInfoOpen": ffi.ForeignFunction(lib.get("AFCFileInfoOpen"), "uint", [CoreTypes.afcConnectionRef, "string", CoreTypes.cfDictionaryRef]),
			"AFCFileRefOpen": (this.$hostInfo.isDarwin || process.arch === "x64") ? ffi.ForeignFunction(lib.get("AFCFileRefOpen"), "uint", [CoreTypes.afcConnectionRef, "string", "uint", ref.refType(CoreTypes.afcFileRef)]) : ffi.ForeignFunction(lib.get("AFCFileRefOpen"), "uint", [CoreTypes.afcConnectionRef, "string", "uint", "uint", ref.refType(CoreTypes.afcFileRef)]),
			"AFCFileRefClose": ffi.ForeignFunction(lib.get("AFCFileRefClose"), "uint", [CoreTypes.afcConnectionRef, CoreTypes.afcFileRef]),
			"AFCFileRefWrite": ffi.ForeignFunction(lib.get("AFCFileRefWrite"), "uint", [CoreTypes.afcConnectionRef, CoreTypes.afcFileRef, CoreTypes.voidPtr, "uint"]),
			"AFCFileRefRead": ffi.ForeignFunction(lib.get("AFCFileRefRead"), "uint", [CoreTypes.afcConnectionRef, CoreTypes.afcFileRef, CoreTypes.voidPtr, CoreTypes.uintPtr]),
			"AFCRemovePath": ffi.ForeignFunction(lib.get("AFCRemovePath"), "uint", [CoreTypes.afcConnectionRef, "string"]),
			"AFCDirectoryOpen": ffi.ForeignFunction(lib.get("AFCDirectoryOpen"), CoreTypes.afcError, [CoreTypes.afcConnectionRef, "string", ref.refType(CoreTypes.afcDirectoryRef)]),
			"AFCDirectoryRead": ffi.ForeignFunction(lib.get("AFCDirectoryRead"), CoreTypes.afcError, [CoreTypes.afcConnectionRef, CoreTypes.afcDirectoryRef, ref.refType(CoreTypes.charPtr)]),
			"AFCDirectoryClose": ffi.ForeignFunction(lib.get("AFCDirectoryClose"), CoreTypes.afcError, [CoreTypes.afcConnectionRef, CoreTypes.afcDirectoryRef]),
			"AMDeviceCopyDeviceIdentifier": ffi.ForeignFunction(lib.get("AMDeviceCopyDeviceIdentifier"), CoreTypes.cfStringRef, [CoreTypes.am_device_p]),
			"AMDeviceCopyValue": ffi.ForeignFunction(lib.get("AMDeviceCopyValue"), CoreTypes.cfStringRef, [CoreTypes.am_device_p, CoreTypes.cfStringRef, CoreTypes.cfStringRef]),
			"AMDeviceNotificationUnsubscribe": ffi.ForeignFunction(lib.get("AMDeviceNotificationUnsubscribe"), CoreTypes.intType, [CoreTypes.amDeviceNotificationRef]),
			"AMDeviceMountImage": this.$hostInfo.isDarwin ? ffi.ForeignFunction(lib.get("AMDeviceMountImage"), CoreTypes.uintType, [CoreTypes.am_device_p, CoreTypes.cfStringRef, CoreTypes.cfDictionaryRef, CoreTypes.am_device_mount_image_callback, CoreTypes.voidPtr]) : null,
			"AMDSetLogLevel": ffi.ForeignFunction(lib.get("AMDSetLogLevel"), CoreTypes.intType, [CoreTypes.intType]),
			"AMDeviceGetInterfaceType": ffi.ForeignFunction(lib.get("AMDeviceGetInterfaceType"), CoreTypes.longType, [CoreTypes.am_device_p]),
			"AMDeviceGetConnectionID": ffi.ForeignFunction(lib.get("AMDeviceGetConnectionID"), CoreTypes.longType, [CoreTypes.am_device_p]),
			"USBMuxConnectByPort": ffi.ForeignFunction(lib.get("USBMuxConnectByPort"), CoreTypes.intType, [CoreTypes.intType, CoreTypes.intType, CoreTypes.intPtr])
		};
	}

	public static getWinSocketLibrary(): { [key: string]: any } {
		let winSocketDll = path.join(process.env.SystemRoot, "System32", "ws2_32.dll");

		return ffi.Library(winSocketDll, {
			"closesocket": ["int", ["uint"]],
			"recv": ["int", ["uint", CoreTypes.charPtr, "int", "int"]],
			"send": ["int", ["uint", CoreTypes.charPtr, "int", "int"]],
			"setsockopt": ["int", ["uint", "int", "int", CoreTypes.voidPtr, "int"]],
			"WSAGetLastError": ["int", []]
		});
	}
}
$injector.register("iOSCore", IOSCore);

export class CoreFoundation implements Mobile.ICoreFoundation {
	private coreFoundationLibrary: any;

	constructor($iOSCore: Mobile.IiOSCore,
		private $errors: IErrors) {
		this.coreFoundationLibrary = $iOSCore.getCoreFoundationLibrary();
	}

	public stringGetMaximumSizeForEncoding(len: number, encoding: number): number {
		return this.coreFoundationLibrary.CFStringGetMaximumSizeForEncoding(len, encoding);
	}

	public runLoopRun(): void {
		this.coreFoundationLibrary.CFRunLoopRun();
	}

	public runLoopGetCurrent(): any {
		return this.coreFoundationLibrary.CFRunLoopGetCurrent();
	}

	public kCFRunLoopCommonModes(): NodeBuffer {
		return this.coreFoundationLibrary.kCFRunLoopCommonModes.deref();
	}

	public kCFRunLoopDefaultMode(): NodeBuffer {
		return this.coreFoundationLibrary.kCFRunLoopDefaultMode.deref();
	}

	public kCFTypeDictionaryValueCallBacks(): NodeBuffer {
		return this.coreFoundationLibrary.kCFTypeDictionaryValueCallBacks;
	}

	public kCFTypeDictionaryKeyCallBacks(): NodeBuffer {
		return this.coreFoundationLibrary.kCFTypeDictionaryKeyCallBacks;
	}

	public runLoopTimerCreate(allocator: NodeBuffer, fireDate: number, interval: number, flags: number, order: number, callout: NodeBuffer, context: any): NodeBuffer {
		return this.coreFoundationLibrary.CFRunLoopTimerCreate(allocator, fireDate, interval, flags, order, callout, context);
	}

	public absoluteTimeGetCurrent(): number {
		return this.coreFoundationLibrary.CFAbsoluteTimeGetCurrent();
	}

	public runLoopAddTimer(r1: NodeBuffer, timer: NodeBuffer, mode: NodeBuffer): void {
		this.coreFoundationLibrary.CFRunLoopAddTimer(r1, timer, mode);
	}

	public runLoopRemoveTimer(r1: NodeBuffer, timer: NodeBuffer, mode: NodeBuffer): void {
		this.coreFoundationLibrary.CFRunLoopRemoveTimer(r1, timer, mode);
	}

	public runLoopStop(r1: any): void {
		this.coreFoundationLibrary.CFRunLoopStop(r1);
	}

	public stringGetCStringPtr(theString: NodeBuffer, encoding: number): any {
		return this.coreFoundationLibrary.CFStringGetCStringPtr(theString, encoding);
	}

	public stringGetLength(theString: NodeBuffer): number {
		return this.coreFoundationLibrary.CFStringGetLength(theString);
	}

	public stringGetCString(theString: NodeBuffer, buffer: any, bufferSize: number, encoding: number): boolean {
		return this.coreFoundationLibrary.CFStringGetCString(theString, buffer, bufferSize, encoding);
	}

	public stringCreateWithCString(alloc: NodeBuffer, str: string, encoding: number): NodeBuffer {
		return this.coreFoundationLibrary.CFStringCreateWithCString(alloc, str, encoding);
	}

	public createCFString(str: string): NodeBuffer {
		return this.stringCreateWithCString(null, str, IOSCore.kCFStringEncodingUTF8);
	}

	public dictionaryCreate(allocator: NodeBuffer, keys: NodeBuffer, values: NodeBuffer, count: number, dictionaryKeyCallbacks: NodeBuffer, dictionaryValueCallbacks: NodeBuffer): NodeBuffer {
		return this.coreFoundationLibrary.CFDictionaryCreate(allocator, keys, values, count, dictionaryKeyCallbacks, dictionaryValueCallbacks);
	}

	public dictionaryGetValue(theDict: NodeBuffer, value: NodeBuffer): NodeBuffer {
		return this.coreFoundationLibrary.CFDictionaryGetValue(theDict, value);
	}

	public dictionaryGetCount(theDict: NodeBuffer): number {
		return this.coreFoundationLibrary.CFDictionaryGetCount(theDict);
	}

	public dictionaryGetKeysAndValues(dictionary: NodeBuffer, keys: NodeBuffer, values: NodeBuffer): void {
		this.coreFoundationLibrary.CFDictionaryGetKeysAndValues(dictionary, keys, values);
	}

	public dictionaryGetTypeID(): number {
		return this.coreFoundationLibrary.CFDictionaryGetTypeID();
	}

	public numberGetValue(num: NodeBuffer, theType: number, valuePtr: NodeBuffer): boolean {
		return this.coreFoundationLibrary.CFNumberGetValue(num, theType, valuePtr);
	}

	public getTypeID(buffer: NodeBuffer): number {
		return this.coreFoundationLibrary.CFGetTypeID(buffer);
	}

	public propertyListCreateData(allocator: NodeBuffer, propertyListRef: NodeBuffer, propertyListFormat: number, optionFlags: number, error: NodeBuffer): NodeBuffer {
		return this.coreFoundationLibrary.CFPropertyListCreateData(allocator, propertyListRef, propertyListFormat, optionFlags, error);
	}

	public propertyListCreateWithData(allocator: NodeBuffer, propertyList: NodeBuffer, optionFlags: number, propertyListFormat: NodeBuffer, error: NodeBuffer): NodeBuffer {
		return this.coreFoundationLibrary.CFPropertyListCreateWithData(allocator, propertyList, optionFlags, propertyListFormat, error);
	}

	public stringGetTypeID(): number {
		return this.coreFoundationLibrary.CFStringGetTypeID();
	}

	public dataGetTypeID(): number {
		return this.coreFoundationLibrary.CFDataGetTypeID();
	}

	public numberGetTypeID(): number {
		return this.coreFoundationLibrary.CFNumberGetTypeID();
	}

	public booleanGetTypeID(): number {
		return this.coreFoundationLibrary.CFBooleanGetTypeID();
	}

	public arrayGetTypeID(): number {
		return this.coreFoundationLibrary.CFArrayGetTypeID();
	}

	public dateGetTypeID(): number {
		return this.coreFoundationLibrary.CFDateGetTypeID();
	}

	public setGetTypeID(): number {
		return this.coreFoundationLibrary.CFSetGetTypeID();
	}

	public dataGetBytePtr(buffer: NodeBuffer): NodeBuffer {
		return this.coreFoundationLibrary.CFDataGetBytePtr(buffer);
	}

	public dataGetLength(buffer: NodeBuffer): number {
		return this.coreFoundationLibrary.CFDataGetLength(buffer);
	}

	public dataCreate(allocator: NodeBuffer, data: NodeBuffer, length: number) {
		return this.coreFoundationLibrary.CFDataCreate(allocator, data, length);
	}

	public convertCFStringToCString(cfstr: NodeBuffer): string {
		let result: string;
		if (cfstr != null) {
			let rawData = this.stringGetCStringPtr(cfstr, IOSCore.kCFStringEncodingUTF8);
			if (ref.address(rawData) === 0) {
				let cfstrLength = this.stringGetLength(cfstr);
				let length = cfstrLength + 1;
				let stringBuffer = new Buffer(length);
				let status = this.stringGetCString(cfstr, stringBuffer, length, IOSCore.kCFStringEncodingUTF8);
				if (status) {
					result = stringBuffer.toString("utf8", 0, cfstrLength);
				}
			} else {
				result = ref.readCString(rawData, 0);
			}
		}

		return result;
	}

	public cfTypeFrom(value: IDictionary<any>): NodeBuffer {
		let keys = _.keys(value);
		let values = _.values(value);

		let len = keys.length;
		let keysBuffer = new Buffer(CoreTypes.pointerSize * len);
		let valuesBuffer = new Buffer(CoreTypes.pointerSize * len);

		let offset = 0;

		for (let i = 0; i < len; i++) {
			let cfKey = this.createCFString(keys[i]);
			let cfValue: any;

			if (typeof values[i] === "string") {
				cfValue = this.createCFString(values[i]);
			} else if (values[i] instanceof Buffer) {
				cfValue = this.dataCreate(null, values[i], values[i].length);
			} else {
				cfValue = this.cfTypeFrom(values[i]);
			}

			ref.writePointer(keysBuffer, offset, cfKey);
			ref.writePointer(valuesBuffer, offset, cfValue);
			offset += CoreTypes.pointerSize;
		}

		return this.dictionaryCreate(null, keysBuffer, valuesBuffer, len, this.kCFTypeDictionaryKeyCallBacks(), this.kCFTypeDictionaryValueCallBacks());
	}

	public cfTypeTo(dataRef: NodeBuffer): any {
		let typeId = this.getTypeID(dataRef);

		if (typeId === this.stringGetTypeID()) {
			return this.convertCFStringToCString(dataRef);
		} else if (typeId === this.dataGetTypeID()) {
			let len = this.dataGetLength(dataRef);
			let retval = ref.reinterpret(this.dataGetBytePtr(dataRef), len);
			return retval;
		} else if (typeId === this.dictionaryGetTypeID()) {
			let count = this.dictionaryGetCount(dataRef);

			let keys = new Buffer(count * CoreTypes.pointerSize);
			let values = new Buffer(count * CoreTypes.pointerSize);
			this.dictionaryGetKeysAndValues(dataRef, keys, values);

			let jsDictionary = Object.create(null);
			let offset = 0;

			for (let i = 0; i < count; i++) {
				let keyPointer = ref.readPointer(keys, offset, CoreTypes.pointerSize);
				let valuePointer = ref.readPointer(values, offset, CoreTypes.pointerSize);
				offset += CoreTypes.pointerSize;

				let jsKey = this.cfTypeTo(keyPointer);
				let jsValue = this.cfTypeTo(valuePointer);
				jsDictionary[jsKey] = jsValue;
			}

			return jsDictionary;
		} else { // We don't need it for now
			return "";
		}
	}

	public dictToPlistEncoding(dict: { [key: string]: {} }, format: number): NodeBuffer {

		let cfDict = this.cfTypeFrom(dict);
		let cfData = this.propertyListCreateData(null, cfDict, format, 0, null);

		return this.cfTypeTo(cfData);
	}

	public dictFromPlistEncoding(str: NodeBuffer): NodeBuffer {
		let retval: NodeBuffer = null;

		let cfData = this.dataCreate(null, str, str.length);
		if (cfData) {
			let cfDict = this.propertyListCreateWithData(null, cfData, CoreTypes.kCFPropertyListImmutable, null, null);
			if (cfDict) {
				retval = this.cfTypeTo(cfDict);
			}
		}

		return retval;
	}
}
$injector.register("coreFoundation", CoreFoundation);

export class MobileDevice implements Mobile.IMobileDevice {
	private mobileDeviceLibrary: any;

	constructor($iOSCore: Mobile.IiOSCore,
		private $errors: IErrors,
		private $hostInfo: IHostInfo) {
		this.mobileDeviceLibrary = $iOSCore.getMobileDeviceLibrary();
	}

	public deviceNotificationSubscribe(notificationCallback: NodeBuffer, p1: number, p2: number, p3: number, callbackSignature: NodeBuffer): number {
		return this.mobileDeviceLibrary.AMDeviceNotificationSubscribe(notificationCallback, p1, p2, p3, callbackSignature);
	}

	public deviceCopyDeviceIdentifier(devicePointer: NodeBuffer): NodeBuffer {
		return this.mobileDeviceLibrary.AMDeviceCopyDeviceIdentifier(devicePointer);
	}

	public deviceCopyValue(devicePointer: NodeBuffer, domain: NodeBuffer, name: NodeBuffer): NodeBuffer {
		return this.mobileDeviceLibrary.AMDeviceCopyValue(devicePointer, domain, name);
	}

	public deviceConnect(devicePointer: NodeBuffer): number {
		return this.mobileDeviceLibrary.AMDeviceConnect(devicePointer);
	}

	public deviceIsPaired(devicePointer: NodeBuffer): number {
		return this.mobileDeviceLibrary.AMDeviceIsPaired(devicePointer);
	}

	public devicePair(devicePointer: NodeBuffer): number {
		return this.mobileDeviceLibrary.AMDevicePair(devicePointer);
	}

	public deviceValidatePairing(devicePointer: NodeBuffer): number {
		return this.mobileDeviceLibrary.AMDeviceValidatePairing(devicePointer);
	}

	public deviceStartSession(devicePointer: NodeBuffer): number {
		return this.mobileDeviceLibrary.AMDeviceStartSession(devicePointer);
	}

	public deviceStopSession(devicePointer: NodeBuffer): number {
		return this.mobileDeviceLibrary.AMDeviceStopSession(devicePointer);
	}

	public deviceDisconnect(devicePointer: NodeBuffer): number {
		return this.mobileDeviceLibrary.AMDeviceDisconnect(devicePointer);
	}

	public deviceStartService(devicePointer: NodeBuffer, serviceName: NodeBuffer, socketNumber: NodeBuffer): number {
		return this.mobileDeviceLibrary.AMDeviceStartService(devicePointer, serviceName, socketNumber, null);
	}

	public deviceTransferApplication(service: number, packageFile: NodeBuffer, options: NodeBuffer, installationCallback: NodeBuffer): number {
		return this.mobileDeviceLibrary.AMDeviceTransferApplication(service, packageFile, options, installationCallback, null);
	}

	public deviceInstallApplication(service: number, packageFile: NodeBuffer, options: NodeBuffer, installationCallback: NodeBuffer): number {
		return this.mobileDeviceLibrary.AMDeviceInstallApplication(service, packageFile, options, installationCallback, null);
	}

	public deviceUninstallApplication(service: number, bundleId: NodeBuffer, options: NodeBuffer, callback: NodeBuffer): number {
		return this.mobileDeviceLibrary.AMDeviceUninstallApplication(service, bundleId, options, callback, null);
	}

	public deviceStartHouseArrestService(devicePointer: NodeBuffer, bundleId: NodeBuffer, options: NodeBuffer, fdRef: NodeBuffer): number {
		return this.mobileDeviceLibrary.AMDeviceStartHouseArrestService(devicePointer, bundleId, options, fdRef, null);
	}

	public deviceMountImage(devicePointer: NodeBuffer, imagePath: NodeBuffer, options: NodeBuffer, mountCallBack: NodeBuffer): number {
		if (this.$hostInfo.isDarwin) {
			return this.mobileDeviceLibrary.AMDeviceMountImage(devicePointer, imagePath, options, mountCallBack, null);
		}

		this.$errors.fail("AMDeviceMountImage is exported only on Darwin OS");
	}

	public deviceLookupApplications(devicePointer: NodeBuffer, appType: number, result: NodeBuffer): number {
		return this.mobileDeviceLibrary.AMDeviceLookupApplications(devicePointer, appType, result);
	}

	public deviceGetInterfaceType(devicePointer: NodeBuffer): number {
		return this.mobileDeviceLibrary.AMDeviceGetInterfaceType(devicePointer);
	}

	public deviceGetConnectionId(devicePointer: NodeBuffer): number {
		return this.mobileDeviceLibrary.AMDeviceGetConnectionID(devicePointer);
	}

	public afcConnectionOpen(service: number, timeout: number, afcConnection: NodeBuffer): number {
		return this.mobileDeviceLibrary.AFCConnectionOpen(service, timeout, afcConnection);
	}

	public afcConnectionClose(afcConnection: NodeBuffer): number {
		return this.mobileDeviceLibrary.AFCConnectionClose(afcConnection);
	}

	public afcDirectoryCreate(afcConnection: NodeBuffer, path: string): number {
		return this.mobileDeviceLibrary.AFCDirectoryCreate(afcConnection, path);
	}

	public afcFileInfoOpen(afcConnection: NodeBuffer, path: string, afcDirectory: NodeBuffer): number {
		return this.mobileDeviceLibrary.AFCFileInfoOpen(afcConnection, path, afcDirectory);
	}

	public afcFileRefOpen(afcConnection: NodeBuffer, path: string, mode: number, afcFileRef: NodeBuffer): number {
		if (this.$hostInfo.isWindows && process.arch === "ia32") {
			return this.mobileDeviceLibrary.AFCFileRefOpen(afcConnection, path, mode, 0, afcFileRef);
		} else if (this.$hostInfo.isDarwin || process.arch === "x64") {
			return this.mobileDeviceLibrary.AFCFileRefOpen(afcConnection, path, mode, afcFileRef);
		}
	}

	public afcFileRefClose(afcConnection: NodeBuffer, afcFileRef: number): number {
		return this.mobileDeviceLibrary.AFCFileRefClose(afcConnection, afcFileRef);
	}

	public afcFileRefWrite(afcConnection: NodeBuffer, afcFileRef: number, buffer: NodeBuffer, byteLength: number): number {
		return this.mobileDeviceLibrary.AFCFileRefWrite(afcConnection, afcFileRef, buffer, byteLength);
	}

	public afcFileRefRead(afcConnection: NodeBuffer, afcFileRef: number, buffer: NodeBuffer, byteLength: NodeBuffer): number {
		return this.mobileDeviceLibrary.AFCFileRefRead(afcConnection, afcFileRef, buffer, byteLength);
	}

	public afcRemovePath(afcConnection: NodeBuffer, path: string): number {
		return this.mobileDeviceLibrary.AFCRemovePath(afcConnection, path);
	}

	public afcDirectoryOpen(afcConnection: NodeBuffer, path: string, afcDirectory: NodeBuffer): number {
		return this.mobileDeviceLibrary.AFCDirectoryOpen(afcConnection, path, afcDirectory);
	}

	public afcDirectoryRead(afcConnection: NodeBuffer, afcDirectory: NodeBuffer, name: NodeBuffer): number {
		return this.mobileDeviceLibrary.AFCDirectoryRead(afcConnection, afcDirectory, name);
	}

	public afcDirectoryClose(afcConnection: NodeBuffer, afcDirectory: NodeBuffer): number {
		return this.mobileDeviceLibrary.AFCDirectoryClose(afcConnection, afcDirectory);
	}

	public isDataReceivingCompleted(reply: Mobile.IiOSSocketResponseData): boolean {
		return reply.Status && reply.Complete && !reply.PercentComplete;
	}

	public setLogLevel(logLevel: number): number {
		return this.mobileDeviceLibrary.AMDSetLogLevel(logLevel);
	}

	public uSBMuxConnectByPort(connectionId: number, port: number, socketRef: NodeBuffer): number {
		return this.mobileDeviceLibrary.USBMuxConnectByPort(connectionId, port, socketRef);
	}
}
$injector.register("mobileDevice", MobileDevice);

export class WinSocket implements Mobile.IiOSDeviceSocket {
	private winSocketLibrary: any = null;
	private static BYTES_TO_READ = 1024;

	constructor(private service: number,
		private format: number,
		private $logger: ILogger,
		private $errors: IErrors,
		private $childProcess: IChildProcess,
		private $staticConfig: Config.IStaticConfig) {
		this.winSocketLibrary = IOSCore.getWinSocketLibrary();
	}

	private read(bytes: number): NodeBuffer {
		let data = new Buffer(bytes);
		let result: Number;
		helpers.block(() => {
			result = this.winSocketLibrary.recv(this.service, data, bytes, 0);
		});
		if (result < 0) {
			this.$errors.fail("Error receiving data: %s", result);
		} else if (result === 0) {
			return null;
		}

		return data;
	}

	public readSystemLogBlocking(): void {
		let data = this.read(WinSocket.BYTES_TO_READ);
		while (data) {
			// On iOS 10 devices the device logs contain \n after each line.
			// When we use readCString for buffers which contain many \0
			// The method will return the content of the buffer only before the first \0 character.
			// We need to replace the \0 with "" in order read the whole content.
			const messageWithoutNullCharacters = data.toString().replace("\0", "");
			const bufferWithoutNullCharacters = new Buffer(messageWithoutNullCharacters);
			const output = ref.readCString(bufferWithoutNullCharacters, 0);
			process.send(output);
			data = this.read(WinSocket.BYTES_TO_READ);
		}
		this.close();
	}

	public readSystemLog(printData: any): void {
		let serviceArg: number | string = this.service || '';
		let formatArg: number | string = this.format || '';
		let sysLog = this.$childProcess.fork(path.join(__dirname, "ios-sys-log.js"),
												[this.$staticConfig.PATH_TO_BOOTSTRAP, serviceArg.toString(), formatArg.toString()],
												{ silent: true });
		sysLog.on('message', (data: any) => {
			printData(data);
		});
	}

	public receiveMessage(): IFuture<Mobile.IiOSSocketResponseData | Mobile.IiOSSocketResponseData[]> {
		return (() => {
			if (this.format === CoreTypes.kCFPropertyListXMLFormat_v1_0) {
				let message = this.receiveMessageCore();
				return plist.parse(message.toString());
			}

			if (this.format === CoreTypes.kCFPropertyListBinaryFormat_v1_0) {
				return this.receiveBinaryMessage();
			}

			return null;
		}).future<Mobile.IiOSSocketResponseData>()();
	}

	public sendMessage(data: any): void {
		let message: NodeBuffer = null;

		if (typeof (data) === "string") {
			message = new Buffer(data);
		} else {
			let payload: NodeBuffer = new Buffer(plistlib.toString(this.createPlist(data)));
			let packed: any = bufferpack.pack(">i", [payload.length]);
			message = Buffer.concat([packed, payload]);
		}

		let writtenBytes = this.sendCore(message);
		this.$logger.debug("WinSocket-> sending message: '%s', written bytes: '%s'", message.toString(), writtenBytes.toString());
		this.$errors.verifyHeap("sendMessage");
	}

	public sendAll(data: NodeBuffer): void {
		while (data.length !== 0) {
			let result = this.sendCore(data);
			if (result < 0) {
				this.$errors.fail("Error sending data: %s", result);
			}
			data = data.slice(result);
		}
	}

	public receiveAll(handler: (_data: NodeBuffer) => void): void {
		let data = this.read(WinSocket.BYTES_TO_READ);
		while (data) {
			handler(data);
			data = this.read(WinSocket.BYTES_TO_READ);
		}
		this.close();
	}

	public exchange(message: IDictionary<any>): IFuture<Mobile.IiOSSocketResponseData> {
		this.sendMessage(message);
		return this.receiveMessage();
	}

	public close(): void {
		this.winSocketLibrary.closesocket(this.service);
		this.$errors.verifyHeap("socket close");
	}

	private receiveBinaryMessage(): Mobile.IiOSSocketResponseData[] {
		let result: Mobile.IiOSSocketResponseData[] = [];
		while (true) {
			let partialReply = this.receiveMessageCore();
			if (!partialReply.length) {
				break;
			}

			let currentResult = bplistParser.parseBuffer(partialReply)[0];
			if (currentResult.Status === "Complete" || !currentResult.Status) {
				break;
			}

			if (currentResult.Error) {
				throw new Error(currentResult.Error);
			}

			result = result.concat(currentResult);
			this.$errors.verifyHeap("receiveMessage");
		}

		return result;
	}

	private receiveMessageCore(): NodeBuffer {
		let data = this.read(4);
		let reply = new Buffer(0);

		if (data !== null && data.length === 4) {
			let bufferLength = bufferpack.unpack(">i", data)[0];
			let remainingSymbols = bufferLength;
			while (remainingSymbols > 0) {
				let currentBuffer = this.read(remainingSymbols);
				if (currentBuffer === null) {
					this.$errors.fail("Unable to read reply");
				}
				reply = Buffer.concat([reply, currentBuffer]);
				remainingSymbols -= currentBuffer.length;
			}
		}

		this.$errors.verifyHeap("receiveMessage");
		return reply;
	}

	private sendCore(data: NodeBuffer): number {
		let writtenBytes = this.winSocketLibrary.send(this.service, data, data.length, 0);
		this.$logger.debug("WinSocket-> sendCore: writtenBytes '%s'", writtenBytes);
		return writtenBytes;
	}

	private createPlist(data: IDictionary<any>): {} {
		let plistData: { type: string; value: any } = {
			type: "dict", value: this.getDataFromObject(data)
		};

		this.$logger.trace("created plist: '%s'", plistData.toString());

		return plistData;
	}

	private getDataFromObject(data: any): any {
		let keys = _.keys(data);
		let values = _.values(data);
		let plistData: any = {};
		for (let i = 0; i < keys.length; i++) {
			plistData[keys[i]] = this.parseValue(values[i]);
		}

		return plistData;
	}

	private parseValue(data: any): any {
		let type = "",
			value: any;

		if (data instanceof Buffer) {
			type = "data";
			value = data.toString("base64");
		} else if (data instanceof Array) {
			type = "array";
			let objs = _.map(data, v => this.parseValue(v));
			value = objs;
		} else if (data instanceof Object) {
			type = "dict";
			value = this.getDataFromObject(data);
		} else if (typeof (data) === "number") {
			type = "integer";
			value = data;
		} else {
			type = "string";
			value = data;
		}

		return { type: type, value: value };
	}
}

enum ReadState {
	Length,
	Plist
}

class PosixSocket implements Mobile.IiOSDeviceSocket {
	private socket: net.Socket = null;

	private buffer: Buffer = new Buffer(0);

	// Initial reading state: We expect to read a 4 bytes length first
	private state: ReadState = ReadState.Length;
	private length: number = 4;

	constructor(service: number,
		private format: number,
		private $coreFoundation: Mobile.ICoreFoundation,
		private $mobileDevice: Mobile.IMobileDevice,
		private $logger: ILogger,
		private $errors: IErrors) {
		this.socket = new net.Socket({ fd: service });
	}

	public receiveMessage(): IFuture<Mobile.IiOSSocketResponseData | Mobile.IiOSSocketResponseData[]> {
		let result = new Future<Mobile.IiOSSocketResponseData>();
		let messages: Mobile.IiOSSocketResponseData[] = [];

		this.socket
			.on("data", (data: NodeBuffer) => {
				this.buffer = Buffer.concat([this.buffer, data]);
				if (this.format === CoreTypes.kCFPropertyListBinaryFormat_v1_0) {
					try {
						while (this.buffer.length >= this.length) {
							switch (this.state) {
								case ReadState.Length:
									this.length = this.buffer.readInt32BE(0);
									this.buffer = this.buffer.slice(4);
									this.state = ReadState.Plist;
									break;
								case ReadState.Plist:
									try {
										let plistBuffer = this.buffer.slice(0, this.length);
										let message = bplistParser.parseBuffer(plistBuffer);
										this.$logger.trace("MESSAGE RECEIVING");
										this.$logger.trace(message);
										try {
											if (message && typeof (message) === "object" && message[0]) {
												message = message[0];
												let output = "";
												if (message.Status) {
													output += util.format("Status: %s", message.Status);
												}
												if (message.PercentComplete) {
													output += util.format(" PercentComplete: %s", message.PercentComplete);
												}
												this.$logger.trace(output);

												let errorMessage: string = "";
												if (message.Error) {
													errorMessage += `Error: ${message.Error} ${EOL}`;
												}
												if (message.ErrorDescription) {
													errorMessage += `ErrorDescription: ${message.ErrorDescription} ${EOL}`;
												}
												if (message.ErrorDetail) {
													errorMessage += `ErrorDetail: ${message.ErrorDetail} ${EOL}`;
												}

												if (errorMessage && !result.isResolved()) {
													result.throw(new Error(errorMessage));
												}

												if (message.Status && message.Status === "Complete") {
													if (!result.isResolved()) {
														result.return(messages);
													}
												} else {
													messages.push(message);
												}

												let status = message.Status;
												let percentComplete = message.PercentComplete;
												this.$logger.trace("Status: " + status + " PercentComplete: " + percentComplete);
											}
										} catch (e) {
											this.$logger.trace("Failed to retreive state: " + e);
										}
									} catch (e) {
										this.$logger.trace("Failed to parse bplist: " + e);
									}

									this.buffer = this.buffer.slice(this.length);

									this.state = ReadState.Length;
									this.length = 4;

									break;
							}
						}
					} catch (e) {
						this.$logger.trace("Exception thrown: " + e);
					}
				} else if (this.format === CoreTypes.kCFPropertyListXMLFormat_v1_0) {
					let parsedData: IDictionary<any> = {};
					try {
						parsedData = plist.parse(this.buffer.toString());
					} catch (e) {
						this.$logger.trace(`An error has occured: ${e.toString()}`);
					}

					if (!result.isResolved()) {
						result.return(parsedData);
					}
				}
			})
			.on("error", (error: Error) => {
				if (!result.isResolved()) {
					result.throw(error);
				}
			});

		return result;
	}

	public readSystemLog(action: (_data: string) => void) {
		this.socket
			.on("data", (data: NodeBuffer) => {
				// We need to use .toString() here instead of ref.readCString() because readCString reads the content of the buffer until the first \0 and sometimes the buffer may contain more than one \0.
				action(data.toString());
			})
			.on("end", () => {
				this.close();
				this.$errors.verifyHeap("readSystemLog");
			})
			.on("error", (error: Error) => {
				this.$errors.fail(error);
			});
	}

	public sendMessage(message: any, format?: number): void {
		if (typeof (message) === "string") {
			this.socket.write(message);
		} else {
			let data = this.$coreFoundation.dictToPlistEncoding(message, format);
			let payload = bufferpack.pack(">i", [data.length]);

			this.$logger.trace("PlistService sending: ");
			this.$logger.trace(data.toString());

			this.socket.write(payload);
			this.socket.write(data);
		}

		this.$errors.verifyHeap("sendMessage");
	}

	public receiveAll(handler: (data: NodeBuffer) => void): void {
		this.socket.on('data', handler);
	}

	public exchange(message: IDictionary<any>): IFuture<Mobile.IiOSSocketResponseData> {
		this.$errors.fail("Exchange function is not implemented for OSX");
		return null;
	}

	public close(): void {
		this.socket.destroy();
		this.$errors.verifyHeap("socket close");
	}
}

export class PlistService implements Mobile.IiOSDeviceSocket {
	private socket: Mobile.IiOSDeviceSocket = null;

	constructor(private service: number,
		private format: number,
		private $injector: IInjector,
		private $processService: IProcessService,
		private $hostInfo: IHostInfo) {
		if (this.$hostInfo.isWindows) {
			this.socket = this.$injector.resolve(WinSocket, { service: this.service, format: this.format });
		} else if (this.$hostInfo.isDarwin) {
			this.socket = this.$injector.resolve(PosixSocket, { service: this.service, format: this.format });
		}
		this.$processService.attachToProcessExitSignals(this, this.close);
	}

	public receiveMessage(): IFuture<Mobile.IiOSSocketResponseData> {
		return this.socket.receiveMessage();
	}

	public readSystemLog(action: (data: string) => void): any {
		this.socket.readSystemLog(action);
	}

	public sendMessage(message: any): void {
		this.socket.sendMessage(message, this.format);
	}

	public exchange(message: IDictionary<any>): IFuture<Mobile.IiOSSocketResponseData> {
		return this.socket.exchange(message);
	}

	public close() {
		this.socket.close();
	}

	public sendAll(data: NodeBuffer): void {
		this.socket.sendAll(data);
	}

	public receiveAll(handler: (data: NodeBuffer) => void): void {
		if (this.socket.receiveAll) {
			this.socket.receiveAll(handler);
		}
	}
}

function getCharacterCodePoint(ch: string) {
	assert.equal(ch.length, 1);

	let code = ch.charCodeAt(0);

	// Surrogate pair
	assert.ok(!(0xD800 <= code && code <= 0xffff));

	return code;
}

class GDBStandardOutputAdapter extends stream.Transform {
	private utf8StringDecoder = new string_decoder.StringDecoder("utf8");

	constructor(private deviceIdentifier: string,
		private $deviceLogProvider: Mobile.IDeviceLogProvider,
		private $devicePlatformsConstants: Mobile.IDevicePlatformsConstants) {
		super();
	}

	public _transform(packet: any, encoding: string, done: Function): void {
		try {
			let result = "";

			for (let i = 0; i < packet.length; i++) {
				if (packet[i] === getCharacterCodePoint("$")) {
					let start = ++i;

					while (packet[i] !== getCharacterCodePoint("#")) {
						i++;
					}
					let end = i;

					// Skip checksum
					i++;
					i++;

					if (!(packet[start] === getCharacterCodePoint("O") && packet[start + 1] !== getCharacterCodePoint("K"))) {
						continue;
					}
					start++;

					let hexString = packet.toString("ascii", start, end);
					let hex = new Buffer(hexString, "hex");
					result += this.utf8StringDecoder.write(hex);
				}
			}

			if (this.$deviceLogProvider) {
				fiberBootstrap.run(() =>
					this.$deviceLogProvider.logData(result, this.$devicePlatformsConstants.iOS, this.deviceIdentifier)
				);
			}

			done(null, result);
		} catch (e) {
			done(e);
		}
	}
}

class GDBSignalWatcher extends stream.Writable {
	constructor(opts?: stream.WritableOptions) {
		super(opts);
	}

	public _write(packet: any, encoding: string, callback: Function) {
		try {
			const dollarCodePoint = getCharacterCodePoint("$");
			const TCodePoint = getCharacterCodePoint("T");
			const SCodePoint = getCharacterCodePoint("S");
			// The reply packages take the following form (the space in the reply templates is included for clarity)
			// ‘S AA’  or ‘T AA n1:r1;n2:r2;...’ meaning that the program received signal number AA (a two-digit hexadecimal number)
			for (let i = 0; i < packet.length - 3; i++) {
				if (packet[i] === dollarCodePoint && (packet[i + 1] === TCodePoint || packet[i + 1] === SCodePoint)) {
					let signalHex = packet.toString("ascii", i + 2, i + 4);
					let signalDecimal = parseInt(signalHex, 16);

					// SIGTRAP || SIGABRT || SIGKILL || SIGSEGV || EXC_BAD_ACCESS
					if (signalDecimal === 5 || signalDecimal === 6 || signalDecimal === 9 || signalDecimal === 11 || signalDecimal === 145) {
						process.exit(1);
					}
				}
			}
			callback(null);
		} catch (e) {
			callback(e);
		}
	}
}

export class GDBServer implements Mobile.IGDBServer {
	private okResponse = "$OK#";
	private isInitilized = false;

	constructor(private socket: any, // socket is fd on Windows and net.Socket on mac
		private deviceIdentifier: string,
		private $injector: IInjector,
		private $hostInfo: IHostInfo,
		private $options: ICommonOptions,
		private $logger: ILogger,
		private $errors: IErrors) {
		if (this.$hostInfo.isWindows) {
			let winSocket = this.$injector.resolve(WinSocket, { service: this.socket, format: 0 });
			this.socket = {
				write: (message: string): void => {
					winSocket.sendMessage(message);
				}
			};
		}

		this.socket.on("close", (hadError: boolean) => this.$logger.trace("GDB socket get closed. HadError", hadError.toString()));
	}

	public init(argv: string[]): IFuture<void> {
		return (() => {
			if (!this.isInitilized) {
				this.awaitResponse("QStartNoAckMode", "+").wait();
				this.sendCore("+");
				this.awaitResponse("QEnvironmentHexEncoded:").wait();
				this.awaitResponse("QSetDisableASLR:1").wait();
				let encodedArguments = _.map(argv, (arg, index) => util.format("%d,%d,%s", arg.length * 2, index, this.toHex(arg))).join(",");
				this.awaitResponse("A" + encodedArguments).wait();

				this.isInitilized = true;
			}
		}).future<void>()();
	}

	public run(argv: string[]): IFuture<void> {
		return (() => {
			this.init(argv).wait();

			this.awaitResponse("qLaunchSuccess").wait();

			if (this.$hostInfo.isWindows) {
				this.send("vCont;c");
			} else {
				if (this.$options.justlaunch) {
					if (this.$options.watch) {
						this.sendCore(this.encodeData("vCont;c"));
					} else {
						// Disconnecting the debugger closes the socket and allows the process to quit
						this.sendCore(this.encodeData("D"));
					}
				} else {
					this.socket.pipe(this.$injector.resolve(GDBStandardOutputAdapter, { deviceIdentifier: this.deviceIdentifier }));
					this.socket.pipe(new GDBSignalWatcher());
					this.sendCore(this.encodeData("vCont;c"));
				}
			}
		}).future<void>()();
	}

	public kill(argv: string[]): IFuture<void> {
		return (() => {
			this.init(argv).wait();

			this.awaitResponse("\x03", "thread", () => this.sendx03Message()).wait();
			this.send("k").wait();
		}).future<void>()();
	}

	public destroy(): void {
		this.socket.destroy();
	}

	private awaitResponse(packet: string, expectedResponse?: string, getResponseAction?: () => IFuture<string>): IFuture<void> {
		return (() => {
			expectedResponse = expectedResponse || this.okResponse;
			let actualResponse = getResponseAction ? getResponseAction.apply(this, []).wait() : this.send(packet).wait();
			if (actualResponse.indexOf(expectedResponse) === -1 || _.startsWith(actualResponse, "$E")) {
				this.$logger.trace(`GDB: actual response: ${actualResponse}, expected response: ${expectedResponse}`);
				this.$errors.failWithoutHelp(`Unable to send ${packet}.`);
			}
		}).future<void>()();
	}

	private send(packet: string): IFuture<string> {
		let future = new Future<string>();

		let dataCallback = (data: any) => {
			this.$logger.trace(`GDB: read packet: ${data}`);
			this.socket.removeListener("data", dataCallback);
			if (!future.isResolved()) {
				future.return(data.toString());
			}
		};

		this.socket.on("data", dataCallback);
		this.socket.on("error", (error: string) => {
			if (!future.isResolved()) {
				future.throw(new Error(error));
			}
		});

		this.sendCore(this.encodeData(packet));

		return future;
	}

	private sendCore(data: string): void {
		this.$logger.trace(`GDB: send packet ${data}`);
		this.socket.write(data);
	}

	private sendx03Message(): IFuture<string> {
		let future = new Future<string>();
		let retryCount = 3;
		let isDataReceived = false;

		let timer = setInterval(() => {
			this.sendCore("\x03");
			retryCount--;

			let secondTimer = setTimeout(() => {
				if (isDataReceived || !retryCount) {
					clearTimeout(secondTimer);
					clearInterval(timer);
				}

				if (!retryCount && !future.isResolved()) {
					future.throw(new Error("Unable to kill the application."));
				}
			}, 1000);
		}, 1000);

		let dataCallback = (data: any) => {
			let dataAsString = data.toString();
			if (dataAsString.indexOf("thread") > -1) {
				isDataReceived = true;
				this.socket.removeListener("data", dataCallback);
				clearInterval(timer);
				if (!future.isResolved()) {
					future.return(data.toString());
				}
			}
		};

		this.socket.on("data", dataCallback);
		this.sendCore("\x03");

		return future;
	}

	private encodeData(packet: string): string {
		let sum = 0;
		for (let i = 0; i < packet.length; i++) {
			sum += getCharacterCodePoint(packet[i]);
		}
		sum = sum & 255;

		let data = util.format("$%s#%s", packet, sum.toString(16));
		return data;
	}

	private toHex(value: string): string {
		return new Buffer(value).toString("hex");
	}
}
$injector.register("gdbServer", GDBServer);
