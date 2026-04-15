import { Platform } from '../../platform/platform';
import type { PixelColor } from '../../platform/types';
import { compressData } from '../../util/compression';
import {
    extentToRect,
    getCoveredTiles,
    intersection,
    type PixelCoordinates,
    type PixelDimensions,
    type PixelRect,
    rectToExtent,
    tileCoordinates,
    type TileCoordinates,
    type TileRect,
    tileToPixelRect,
    worldWrapTileCoordinates,
} from '../../util/geometry';
import { ImageTools } from '../../workers/image-tools-dispatcher';

export interface OptimizedTemplateTile {
    /**
     * tile position
     */
    tilePosition: TileCoordinates;

    /**
     * position and dimensions within the tile
     */
    imageRect: PixelRect;

    /**
     * compressed binary data containing color indexes
     *
     * this assumes the palette never changes
     */
    compressedData: ArrayBuffer;
}

export interface OptimizedTemplateData {
    /**
     * hash of the original image, used as a key
     */
    hash: string;

    /**
     * version of the palette this was optimized with, used to determine whether the template needs to be re-optimized
     * and re-saved
     */
    paletteVersion: number;

    /**
     * position of the original template image, if the template moves then this can be used to determine whether it
     * needs to be re-optimized and re-saved
     */
    position: PixelCoordinates;

    /**
     * tile size this was stored with, in case the canvas changes tile sizes for some reason...
     *
     * bplace has done this once already so it's better to be safe here, worst case this just causes the template to be
     * re-optimized and re-saved with new tile size
     */
    tileSize: PixelDimensions;

    tiles: OptimizedTemplateTile[];
}

async function optimizeTile(
    tileRect: TileRect,
    imageData: ImageData,
    imageRect: PixelRect,
    palette: readonly PixelColor[],
): Promise<OptimizedTemplateTile | null> {
    const borderResult = await ImageTools.findTransparentBorder(imageData);

    if (borderResult === 'fullyTransparent') {
        return null;
    } else if (borderResult !== 'noTransparentBorder') {
        imageData = ImageTools.cropToArea(imageData, borderResult);
        imageRect = extentToRect(borderResult);
    }

    const paletteIndexBuffer = await ImageTools.imageToPaletteIndexBuffer(imageData, palette);
    const compressedData = await compressData(paletteIndexBuffer.buffer, 'gzip');

    return {
        tilePosition: tileCoordinates({ x: tileRect.x, y: tileRect.y }),
        imageRect,
        compressedData,
    };
}

export async function optimizeTemplate(image: ImageData, position: PixelCoordinates): Promise<OptimizedTemplateData> {
    const coveredTiles = getCoveredTiles(
        { ...position, width: image.width, height: image.height },
        Platform.tileDimensions,
    );

    const optimizedTilesPromises = coveredTiles.map((tile) => {
        const tilePixelRect = tileToPixelRect(tile, Platform.tileDimensions);
        const tileImageRect = intersection(tilePixelRect, { ...position, width: image.width, height: image.height });
        if (!tileImageRect) {
            // this should never happen
            throw new Error('Tile does not intersect with image, this should never happen');
        }

        const tileImageData = ImageTools.cropToArea(image, rectToExtent(tileImageRect));

        return optimizeTile(tile, tileImageData, tileImageRect, Platform.colors);
    });

    const optimizedTiles = await Promise.all(optimizedTilesPromises);

    return {
        hash: await ImageTools.computeImageHash(image),
        paletteVersion: Platform.colorsVersion,
        position,
        tileSize: { ...Platform.tileDimensions },
        tiles: optimizedTiles
            .filter((tile) => tile != null)
            .map((tile) => ({
                ...tile,
                tilePosition: worldWrapTileCoordinates(tile.tilePosition, Platform.canvasPixelDimensions),
            })),
    };
}
