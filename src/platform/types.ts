import type { Map as MapLibreInstance } from 'maplibre-gl';
import type { HTMLElementChild } from '../core/dom/html';
import type { PixelColor } from '../core/types';
import type { ActiveToolPanelRef } from '../ui/components/active-tool-panel';
import type { MapTileCoordinates, MapTileExtent, PixelDimensions, RenderTileDimensions } from '../util/geometry';
import type { EffectContext } from './reactivity/effects';

export interface CanvasPlatform {
    readonly id: string;
    readonly colors: readonly PixelColor[];
    readonly colorsVersion: number;
    readonly canvasPixelDimensions: PixelDimensions;
    readonly canvasRenderTileDimensions: RenderTileDimensions;
    readonly mapTilePixelDimensions: PixelDimensions;
    readonly renderTilePixelDimensions: PixelDimensions;

    initialize(): Promise<void> | void;
    addMapInstanceHook(resolveMapInstance: (mapInstance: MapLibreInstance) => void): Promise<void>;
    getCurrentColor(colors: readonly PixelColor[]): PixelColor | null;
    renderPlatformSpecificAppViewContent(): HTMLElementChild | HTMLElementChild[] | null;
    renderPlatformSpecificSettingsContent(context: EffectContext): HTMLElementChild | HTMLElementChild[] | null;
    fetchTileImage(tileCoords: MapTileCoordinates): Promise<ImageBitmap | null>;
    createTilesRegionGenerator(
        extent: MapTileExtent,
    ): AsyncGenerator<{ tileCoords: MapTileCoordinates; tileBitmap: ImageBitmap | null }>;
}

export interface ActiveTool {
    readonly id: string;
    activate(toolPanel: ActiveToolPanelRef): Promise<void> | void;
    close(): Promise<void> | void;
}
