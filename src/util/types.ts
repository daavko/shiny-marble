declare const brandSymbol: unique symbol;

export type Brand<T, B> = T & { [brandSymbol]: B };

export function brand<T, B>(value: T): Brand<T, B> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- safe
    return value as Brand<T, B>;
}
