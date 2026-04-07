import type { Map as MapLibreInstance } from 'maplibre-gl';
import type { HTMLElementChild } from '../core/dom/html';
import type { Dimensions } from '../util/geometry';

export interface PixelColor {
    name: string;
    hex: string;
    rgba: number;
}

export interface CanvasPlatform {
    readonly colors: readonly PixelColor[];
    readonly canvasSizePixels: Dimensions;
    readonly tileDimensions: Dimensions;

    initialize(): Promise<void> | void;
    addMapInstanceHook(resolveMapInstance: (mapInstance: MapLibreInstance) => void): Promise<void>;
    getCurrentColor(colors: readonly PixelColor[]): PixelColor | null;
    renderPlatformSpecificAppViewContent(): HTMLElementChild | HTMLElementChild[] | null;
    renderPlatformSpecificSettingsContent(destoryPromise: Promise<void>): HTMLElementChild | HTMLElementChild[] | null;
}
