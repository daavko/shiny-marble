import type { Map as MapLibreInstance } from 'maplibre-gl';
import type { HTMLElementChild } from '../core/dom/html';
import type { EffectContext } from '../core/effects';
import type { PixelDimensions } from '../util/geometry';

export interface PixelColor {
    name: string;
    hex: string;
    rgba: number;
}

export interface CanvasPlatform {
    readonly colors: readonly PixelColor[];
    readonly colorsVersion: number;
    readonly canvasSizePixels: PixelDimensions;
    readonly tileDimensions: PixelDimensions;

    initialize(): Promise<void> | void;
    addMapInstanceHook(resolveMapInstance: (mapInstance: MapLibreInstance) => void): Promise<void>;
    getCurrentColor(colors: readonly PixelColor[]): PixelColor | null;
    renderPlatformSpecificAppViewContent(): HTMLElementChild | HTMLElementChild[] | null;
    renderPlatformSpecificSettingsContent(context: EffectContext): HTMLElementChild | HTMLElementChild[] | null;
}
