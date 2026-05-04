import type { TileId } from '../platform/template/common';
import type { PixelRect } from '../util/geometry';

export interface TemplateTile {
    rect: PixelRect;
    data: ArrayBuffer;
}

export interface RenderTileCompositingRequest {
    tileId: TileId;
    size: number;
    version: number;
    /**
     * ordered list, back to front
     */
    templateTiles: TemplateTile[];
    transparentColorIndex: number;
}

export interface RenderTileCompositingResponse {
    tileId: TileId;
    version: number;
    data: ArrayBuffer;
}
