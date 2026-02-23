export function isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value != null;
}

export function isObjectAndHasProperty<PropertyName extends string>(
    value: unknown,
    property: PropertyName,
): value is Record<PropertyName, unknown> {
    return isObject(value) && Reflect.has(value, property);
}

export type TypeOf = 'string' | 'number' | 'boolean' | 'symbol' | 'undefined' | 'object' | 'function' | 'bigint';
export interface TypeOfMap {
    string: string;
    number: number;
    boolean: boolean;
    symbol: symbol;
    undefined: undefined;
    object: object;
    function: (...args: unknown[]) => unknown;
    bigint: bigint;
}

export function hasPropertyOfType<PropertyName extends string, TypeOfKey extends keyof TypeOfMap>(
    value: Record<string, unknown>,
    property: PropertyName,
    type: TypeOfKey,
): value is Record<PropertyName, TypeOfMap[TypeOfKey]> {
    if (type === 'object') {
        return isObjectAndHasProperty(value, property) && value[property] !== null;
    } else {
        return typeof value[property] === type;
    }
}
