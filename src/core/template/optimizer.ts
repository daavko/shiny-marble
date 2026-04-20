import { Platform } from '../../platform/platform';
import type { PixelColor } from '../../platform/types';
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
     * binary data containing color indexes
     *
     * this assumes the palette never changes
     */
    data: ArrayBuffer;
}

export interface OptimizedTemplateData {
    /**
     * id of the template, used as a key
     */
    id: string;

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
        imageData = ImageTools.cropToExtent(imageData, borderResult);
        imageRect = extentToRect(borderResult);
    }

    const paletteIndexBuffer = await ImageTools.imageToPaletteIndexBuffer(imageData, palette);

    return {
        tilePosition: tileCoordinates({ x: tileRect.x, y: tileRect.y }),
        imageRect,
        data: paletteIndexBuffer,
    };
}

export async function optimizeTemplate(
    templateId: string,
    image: ImageData,
    position: PixelCoordinates,
): Promise<OptimizedTemplateData> {
    const coveredTiles = getCoveredTiles(
        { ...position, width: image.width, height: image.height },
        Platform.tilePixelDimensions,
    );

    const optimizedTilesPromises = coveredTiles.map((tile) => {
        const tilePixelRect = tileToPixelRect(tile, Platform.tilePixelDimensions);
        const tileImageRect = intersection(tilePixelRect, { ...position, width: image.width, height: image.height });
        if (!tileImageRect) {
            // this should never happen
            throw new Error('Tile does not intersect with image, this should never happen');
        }

        const tileImageData = ImageTools.cropToExtent(image, rectToExtent(tileImageRect));

        return optimizeTile(tile, tileImageData, tileImageRect, Platform.colors);
    });

    const optimizedTiles = await Promise.all(optimizedTilesPromises);

    return {
        id: templateId,
        paletteVersion: Platform.colorsVersion,
        position,
        tileSize: { ...Platform.tilePixelDimensions },
        tiles: optimizedTiles
            .filter((tile) => tile != null)
            .map((tile) => ({
                ...tile,
                tilePosition: worldWrapTileCoordinates(
                    tile.tilePosition,
                    Platform.tilePixelDimensions,
                    Platform.canvasPixelDimensions,
                ),
            })),
    };
}
