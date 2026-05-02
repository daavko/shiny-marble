/**
 * This file is a partial vendored copy of maplibre-gl-js/src/util/util.ts from MapLibre GL JS v5.24.0,
 * with minor modifications where modern TS can infer types and things like that
 *
 * MapLibre GL JS is licensed under the BSD 3-Clause License, see
 * https://github.com/maplibre/maplibre-gl-js/blob/main/LICENSE.txt
 */

/**
 * constrain n to the given range, excluding the minimum, via modular arithmetic
 *
 * @param n - value
 * @param min - the minimum value to be returned, exclusive
 * @param max - the maximum value to be returned, inclusive
 * @returns constrained number
 */
export function wrap(n: number, min: number, max: number): number {
    const d = max - min;
    const w = ((((n - min) % d) + d) % d) + min;
    return w === min ? max : w;
}
