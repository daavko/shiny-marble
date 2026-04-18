import type { PixelColor } from '../platform/types';

export function simpleNamedColorToPixelColor(name: string, rgba: number): PixelColor {
    const red = rgba & 0xff;
    const green = (rgba >> 8) & 0xff;
    const blue = (rgba >> 16) & 0xff;
    const alpha = (rgba >> 24) & 0xff;
    const hex = `#${padHex(red)}${padHex(green)}${padHex(blue)}${padHex(alpha)}`;
    return { name, hex, rgba, red, green, blue, alpha };
}

export function createPixelColorIndexLut(colors: readonly PixelColor[]): Record<number, number | undefined> {
    return Object.fromEntries(colors.map((color) => [color.rgba, color.rgba]));
}

export function rgbToRgbaRaw(r: number, g: number, b: number): number {
    const a = 255;
    return ((a << 24) | (b << 16) | (g << 8) | r) >>> 0;
}

const RGB_COLOR_REGEX = /rgb\(([0-9]+), ([0-9]+), ([0-9]+)\)/;

export function rgbBackgroundStyleToRgbaRaw(backgroundStyle: string): number | null {
    const rgbMatch = RGB_COLOR_REGEX.exec(backgroundStyle);
    if (!rgbMatch) {
        return null;
    }
    const r = parseInt(rgbMatch[1], 10);
    const g = parseInt(rgbMatch[2], 10);
    const b = parseInt(rgbMatch[3], 10);
    return rgbToRgbaRaw(r, g, b);
}

function padHex(value: number): string {
    return value.toString(16).padStart(2, '0');
}
