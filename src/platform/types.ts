import type { Map as MapLibreInstance } from 'maplibre-gl';
import type { HTMLElementChild } from '../core/dom/html';
import type { EffectContext } from '../core/effects';
import type { PixelDimensions } from '../util/geometry';

export interface PixelColor {
    readonly name: string;
    readonly hex: string;
    readonly rgba: number;
    readonly red: number;
    readonly green: number;
    readonly blue: number;
    readonly alpha: number;
}

export interface CanvasPlatform {
    readonly id: string;
    readonly colors: readonly PixelColor[];
    readonly colorsVersion: number;
    readonly canvasPixelDimensions: PixelDimensions;
    readonly tileDimensions: PixelDimensions;

    initialize(): Promise<void> | void;
    addMapInstanceHook(resolveMapInstance: (mapInstance: MapLibreInstance) => void): Promise<void>;
    getCurrentColor(colors: readonly PixelColor[]): PixelColor | null;
    renderPlatformSpecificAppViewContent(): HTMLElementChild | HTMLElementChild[] | null;
    renderPlatformSpecificSettingsContent(context: EffectContext): HTMLElementChild | HTMLElementChild[] | null;
}
