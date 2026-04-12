export function sameValueZero(x: unknown, y: unknown): boolean {
    return x === y || (typeof x === 'number' && typeof y === 'number' && isNaN(x) && isNaN(y));
}
