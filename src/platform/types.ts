import type { Map as MapLibreInstance } from 'maplibre-gl';
import type { HTMLElementChild } from '../dom/html';

export interface PixelColor {
    name: string;
    hex: string;
    rgba: number;
}

export interface CanvasPlatform {
    readonly colors: readonly PixelColor[];

    insertPlatformStyles(): void;
    addMapInstanceHook(resolveMapInstance: (mapInstance: MapLibreInstance) => void): Promise<void>;
    getCurrentColor(colors: readonly PixelColor[]): PixelColor | null;
    renderPlatformSpecificAppViewContent(): HTMLElementChild | HTMLElementChild[] | null;
}
