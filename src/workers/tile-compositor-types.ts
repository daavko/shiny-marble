import type { TileId } from '../platform/template/common';
import type { PixelDimensions, PixelRect } from '../util/geometry';

export interface TemplateTile {
    rect: PixelRect;
    data: ArrayBuffer;
}

export interface RenderTileCompositingRequest {
    id: string;
    tileId: TileId;
    dimensions: PixelDimensions;
    /**
     * ordered list, back to front
     */
    templateTiles: TemplateTile[];
    transparentColorIndex: number;
}

export interface RenderTileCompositingSuccessResult {
    id: string;
    tileId: TileId;
    success: true;
    data: ArrayBuffer;
}

export interface RenderTileCompositingErrorResult {
    id: string;
    tileId: TileId;
    success: false;
    error: unknown;
}

export type RenderTileCompositingResult = RenderTileCompositingSuccessResult | RenderTileCompositingErrorResult;
