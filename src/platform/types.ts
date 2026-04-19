import type { Map as MapLibreInstance } from 'maplibre-gl';
import type { HTMLElementChild } from '../core/dom/html';
import type { EffectContext } from '../core/effects';
import type { ActiveToolPanelRef } from '../ui/components/active-tool-panel';
import type { PixelDimensions, TileCoordinates } from '../util/geometry';

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
    readonly tilePixelDimensions: PixelDimensions;

    initialize(): Promise<void> | void;
    addMapInstanceHook(resolveMapInstance: (mapInstance: MapLibreInstance) => void): Promise<void>;
    getCurrentColor(colors: readonly PixelColor[]): PixelColor | null;
    renderPlatformSpecificAppViewContent(): HTMLElementChild | HTMLElementChild[] | null;
    renderPlatformSpecificSettingsContent(context: EffectContext): HTMLElementChild | HTMLElementChild[] | null;
    fetchTileImage(tileCoords: TileCoordinates): Promise<ImageBitmap | null>;
}

export interface ActiveTool {
    readonly id: string;
    activate(toolPanel: ActiveToolPanelRef): Promise<void> | void;
    close(): Promise<void> | void;
}
