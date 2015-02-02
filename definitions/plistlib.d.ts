declare module "plistlib" {
    export function toString(data: any): string;
    export function loadBuffer(data: NodeBuffer, callback: (err: any, plist: any) => void): void;
    export function loadString(data: string, callback: (err: any, plist: any) => void): void;
}