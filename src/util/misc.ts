export function sameValueZero(x: unknown, y: unknown): boolean {
    return x === y || (typeof x === 'number' && typeof y === 'number' && isNaN(x) && isNaN(y));
}

export function arrayEqualityFn<T>(
    a: readonly T[],
    b: readonly T[],
    elementEqualityFn: (x: T, y: T) => boolean = sameValueZero,
): boolean {
    if (a === b) {
        return true;
    }
    if (a.length !== b.length) {
        return false;
    }
    for (let i = 0; i < a.length; i++) {
        if (!elementEqualityFn(a[i], b[i])) {
            return false;
        }
    }
    return true;
}
