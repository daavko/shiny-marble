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

export function rgbaRawToHexWithAlpha(rgba: number): string {
    const r = rgba & 0xff;
    const g = (rgba >> 8) & 0xff;
    const b = (rgba >> 16) & 0xff;
    const a = (rgba >> 24) & 0xff;
    return `#${padHex(r)}${padHex(g)}${padHex(b)}${padHex(a)}`;
}
