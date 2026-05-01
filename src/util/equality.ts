import type { Coordinates, Dimensions, Extent, Rect } from './geometry';
import type { Brand } from './types';

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

export function coordsEqualityFn<T>(
    coords1: Brand<Coordinates, T> | null | undefined,
    coords2: Brand<Coordinates, T> | null | undefined,
): boolean {
    if (coords1 == null || coords2 == null) {
        return coords1 === coords2;
    } else {
        return coords1.x === coords2.x && coords1.y === coords2.y;
    }
}

export function dimensionsEqualityFn<T>(
    dimensions1: Brand<Dimensions, T> | null | undefined,
    dimensions2: Brand<Dimensions, T> | null | undefined,
): boolean {
    if (dimensions1 == null || dimensions2 == null) {
        return dimensions1 === dimensions2;
    } else {
        return dimensions1.width === dimensions2.width && dimensions1.height === dimensions2.height;
    }
}

export function rectsEqualityFn<T>(
    rect1: Brand<Rect, T> | null | undefined,
    rect2: Brand<Rect, T> | null | undefined,
): boolean {
    if (rect1 == null || rect2 == null) {
        return rect1 === rect2;
    } else {
        return (
            rect1.x === rect2.x && rect1.y === rect2.y && rect1.width === rect2.width && rect1.height === rect2.height
        );
    }
}

export function extentsEqualityFn<T>(
    extent1: Brand<Extent, T> | null | undefined,
    extent2: Brand<Extent, T> | null | undefined,
): boolean {
    if (extent1 == null || extent2 == null) {
        return extent1 === extent2;
    } else {
        return (
            extent1.minX === extent2.minX &&
            extent1.minY === extent2.minY &&
            extent1.maxX === extent2.maxX &&
            extent1.maxY === extent2.maxY
        );
    }
}
