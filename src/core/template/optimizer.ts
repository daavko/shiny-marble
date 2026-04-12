import type { PixelColor } from '../../platform/types';
import type { Dimensions, Point } from '../../util/geometry';

export interface OptimizedTemplateTile {
    /**
     * tile position in tile coordinates
     */
    tile: Point;

    /**
     * position within the tile in pixel coordinates
     */
    position: Point;

    /**
     * dimensions of the compressed data in pixel coordinates
     */
    dimensions: Dimensions;

    /**
     * compressed binary data containing color indexes
     *
     * this assumes the palette never changes
     */
    compressedData: ArrayBuffer;
}

export interface OptimizedTemplateData {
    hash: string;

    /**
     * position of the optimized data in pixel coordinates, if the template moves then this can be used to determine
     * whether it needs to be re-optimized and re-saved
     */
    position: Point;

    /**
     * tile size this was stored with, in case the canvas changes tile sizes for some reason...
     *
     * bplace has done this once already so it's better to be safe here, worst case this just causes the template to be
     * re-optimized and re-saved with new tile size
     */
    tileSize: Dimensions;

    tiles: OptimizedTemplateTile[];
}

export async function optimizeTemplate(
    image: ImageData,
    position: Point,
    tileSize: Dimensions,
    palette: readonly PixelColor[],
): Promise<OptimizedTemplateData> {}
