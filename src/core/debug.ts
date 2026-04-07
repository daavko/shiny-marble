import { PlatformSettings } from '../platform/platform';
import { downloadBlob } from '../util/file';

const DEBUG_LOG: string[] = [];

export function debugEnabled(): boolean {
    return PlatformSettings.debug.value;
}

export function debug(message: string, ...data: unknown[]): void {
    logDebug(message, 1, ...data);
}

export function debugDetailed(message: string, ...data: unknown[]): void {
    logDebug(message, 5, ...data);
}

function logDebug(message: string, stringifyDepth: number, ...data: unknown[]): void {
    if (debugEnabled()) {
        console.debug('[SM]', message, ...data);
        const stringifiedData: string[] = [];
        for (const d of data) {
            try {
                stringifiedData.push(stringifyArbitraryValue(d, stringifyDepth));
            } catch (e) {
                stringifiedData.push(`[Unserializable data: ${String(e)}; value: ${String(d)}]`);
            }
        }
        const formattedMessage = `[${new Date().toISOString()}] ${message}`;
        if (stringifiedData.length > 0) {
            DEBUG_LOG.push(`${formattedMessage}; ${stringifiedData.join(', ')}`);
        } else {
            DEBUG_LOG.push(formattedMessage);
        }
    }
}

export interface DebugTimer {
    stop(): void;
    mark(message: string): void;
}

export function debugTime(timerName: string): DebugTimer | null {
    const timerNameWithId = `${timerName} (${window.crypto.randomUUID()})`;
    const fullTimingName = `[SM] ${timerNameWithId}`;
    if (debugEnabled()) {
        debug(`${timerNameWithId} timer started`);
        console.time(fullTimingName);
        return {
            stop: (): void => {
                console.timeEnd(fullTimingName);
            },
            mark: (msg): void => {
                console.timeLog(fullTimingName, msg);
            },
        };
    } else {
        return null;
    }
}

export function resizeDebugLog(newSize: number): void {
    if (DEBUG_LOG.length > newSize) {
        const retainedEntries = DEBUG_LOG.slice(-newSize);
        DEBUG_LOG.length = 0;
        DEBUG_LOG.push(...retainedEntries);
    }
}

export function downloadDebugLog(): void {
    const blob = new Blob([DEBUG_LOG.join('\n')], { type: 'text/plain' });
    downloadBlob(blob, `sm-debug-log-${new Date().toISOString()}.log`);
}

function filterWellKnownKeys(keys: Set<string | symbol>): Set<string | symbol> {
    const wellKnownKeys = new Set<string | symbol>([
        'constructor',
        '__proto__',
        Symbol.asyncIterator,
        Symbol.iterator,
        Symbol.hasInstance,
        Symbol.isConcatSpreadable,
        Symbol.match,
        Symbol.replace,
        Symbol.search,
        Symbol.species,
        Symbol.split,
        Symbol.toPrimitive,
        Symbol.toStringTag,
        Symbol.unscopables,
    ]);
    return keys.difference(wellKnownKeys);
}

function stringifyObject(obj: object, depth: number): string {
    const ownKeys = Reflect.ownKeys(obj);
    const objPrototype = Reflect.getPrototypeOf(obj);
    let prototypeKeys: (string | symbol)[] = [];
    if (objPrototype && objPrototype !== Object.prototype) {
        prototypeKeys = Reflect.ownKeys(objPrototype);
    }

    let objectName = '';
    try {
        if (objPrototype) {
            if (prototypeKeys.includes(Symbol.toStringTag)) {
                objectName = String(Reflect.get(objPrototype, Symbol.toStringTag));
            } else if (prototypeKeys.includes('constructor')) {
                const constructor: unknown = Reflect.get(objPrototype, 'constructor');
                if (typeof constructor === 'function') {
                    objectName = constructor.name;
                }
            }
        } else if (ownKeys.includes(Symbol.toStringTag)) {
            objectName = String(Reflect.get(obj, Symbol.toStringTag));
        }
    } catch {
        // no-op
    }

    if (objectName === '') {
        objectName = 'Object';
    }

    if (depth <= 0) {
        return objectName;
    }

    const allKeys = filterWellKnownKeys(new Set([...ownKeys, ...prototypeKeys]));
    const stringifiedEntries: string[] = [];

    for (const key of allKeys) {
        try {
            const value: unknown = Reflect.get(obj, key);
            const stringifiedValue = stringifyArbitraryValue(value, depth);
            stringifiedEntries.push(`${String(key)}: ${stringifiedValue}`);
        } catch {
            stringifiedEntries.push(`${String(key)}: Unserializable`);
        }
    }

    return `${objectName} { ${stringifiedEntries.join(', ')} }`;
}

function stringifyArray(array: unknown[], depth: number): string {
    if (depth <= 0) {
        return 'Array';
    } else if (array.length > 10) {
        return `Array(${array.length}) [${array
            .slice(0, 10)
            .map((item) => stringifyArbitraryValue(item, depth - 1))
            .join(', ')}, ...]`;
    } else {
        return `[${array.map((item) => stringifyArbitraryValue(item, depth - 1)).join(', ')}]`;
    }
}

function stringifyMap(map: Map<unknown, unknown>, depth: number): string {
    if (depth <= 0) {
        return 'Map';
    }

    const stringifiedEntries: string[] = [];
    for (const [key, value] of map.entries().take(10)) {
        const stringifiedKey = stringifyArbitraryValue(key, depth - 1);
        const stringifiedValue = stringifyArbitraryValue(value, depth - 1);
        stringifiedEntries.push(`[${stringifiedKey} => ${stringifiedValue}]`);
    }

    if (map.size > 10) {
        stringifiedEntries.push('...');
    }

    return `Map { ${stringifiedEntries.join(', ')} }`;
}

function stringifySet(set: Set<unknown>, depth: number): string {
    if (depth <= 0) {
        return 'Set';
    }

    const stringifiedItems: string[] = [];
    for (const item of set.values().take(10)) {
        stringifiedItems.push(stringifyArbitraryValue(item, depth - 1));
    }

    if (set.size > 10) {
        stringifiedItems.push('...');
    }

    return `Set { ${stringifiedItems.join(', ')} }`;
}

type InternalTypedArray =
    | Int8Array
    | Uint8Array
    | Uint8ClampedArray
    | Int16Array
    | Uint16Array
    | Int32Array
    | Uint32Array
    | BigInt64Array
    | BigUint64Array
    | Float16Array
    | Float32Array
    | Float64Array;

function isTypedArray(value: unknown): value is InternalTypedArray {
    return (
        value instanceof Int8Array ||
        value instanceof Uint8Array ||
        value instanceof Uint8ClampedArray ||
        value instanceof Int16Array ||
        value instanceof Uint16Array ||
        value instanceof Int32Array ||
        value instanceof Uint32Array ||
        value instanceof BigInt64Array ||
        value instanceof BigUint64Array ||
        value instanceof Float16Array ||
        value instanceof Float32Array ||
        value instanceof Float64Array
    );
}

type InternalBuiltinClassWithoutSpecialDebugBehavior =
    | WeakMap<WeakKey, unknown>
    | WeakSet<WeakKey>
    | Iterator<unknown>
    | Promise<unknown>
    | RenderingContext
    | OffscreenRenderingContext;

function isBuiltinClassWithoutSpecialDebugBehavior(
    value: unknown,
): value is InternalBuiltinClassWithoutSpecialDebugBehavior {
    return (
        value instanceof WeakMap ||
        value instanceof WeakSet ||
        value instanceof Iterator ||
        value instanceof Promise ||
        value instanceof ImageBitmapRenderingContext ||
        value instanceof CanvasRenderingContext2D ||
        value instanceof WebGLRenderingContext ||
        value instanceof WebGL2RenderingContext ||
        value instanceof OffscreenCanvasRenderingContext2D
    );
}

function stringifyArbitraryValue(value: unknown, depth: number): string {
    switch (typeof value) {
        case 'string':
            return `"${value}"`;
        case 'number':
        case 'boolean':
        case 'undefined':
            return `${value}`;
        case 'bigint':
            return `${value}n`;
        case 'symbol':
            return value.toString();
        case 'function':
            return value.name === '' ? '[Function]' : `[Function ${value.name}]`;
        case 'object':
            if (value === null) {
                return 'null';
            } else if (value instanceof Node) {
                return `Node ${value.constructor.name}`;
            } else if (value instanceof Error) {
                const stringifiedCause =
                    value.cause != null ? `; cause: ${stringifyArbitraryValue(value.cause, depth - 1)}` : '';
                const stackInfo = value.stack != null ? `; ${value.stack}` : '; no stack trace';
                return `Error ${value.name}: ${value.message}${stringifiedCause}${stackInfo}`;
            } else if (value instanceof Date) {
                return `Date ${value.toISOString()}`;
            } else if (value instanceof RegExp) {
                return `RegExp ${value.toString()}`;
            } else if (value instanceof ArrayBuffer) {
                return `ArrayBuffer [${value.byteLength} bytes]`;
            } else if (isTypedArray(value)) {
                return `${value.constructor.name} [${value.length}]`;
            } else if (value instanceof DataView) {
                return `DataView [byteLength: ${value.byteLength}]`;
            } else if (value instanceof WeakRef) {
                return `WeakRef(${stringifyArbitraryValue(value.deref(), depth - 1)})`;
            } else if (isBuiltinClassWithoutSpecialDebugBehavior(value)) {
                return value.constructor.name;
            } else if (Array.isArray(value)) {
                return stringifyArray(value, depth - 1);
            } else if (value instanceof Map) {
                return stringifyMap(value, depth - 1);
            } else if (value instanceof Set) {
                return stringifySet(value, depth - 1);
            } else if (value instanceof Blob) {
                return `Blob [type: ${value.type}; size: ${value.size} bytes]`;
            } else if (value instanceof ImageData) {
                return `ImageData [width: ${value.width}; height: ${value.height}]`;
            } else {
                return stringifyObject(value, depth - 1);
            }
    }
}
