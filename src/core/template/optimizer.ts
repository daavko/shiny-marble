import { Platform } from '../../platform/platform';
import type { PixelColor } from '../../platform/types';
import {
    getCoveredRenderTiles,
    intersection,
    renderTileToPixelRect,
    worldWrapRenderTileCoordinates,
} from '../../util/geometry';
import {
    extentToRect,
    type PixelCoordinates,
    type PixelDimensions,
    type PixelRect,
    rectToExtent,
    type RenderTileCoordinates,
} from '../../util/geometry-basic';
import { ImageTools } from '../../workers/image-tools-dispatcher';

export interface OptimizedTemplateTile {
    /**
     * tile position
     */
    tilePosition: RenderTileCoordinates;

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
    tilePosition: RenderTileCoordinates,
    imageData: ImageData,
    imageRect: PixelRect,
    palette: readonly PixelColor[],
): Promise<OptimizedTemplateTile | null> {
    const borderResult = await ImageTools.findTransparentBorder(imageData);

    if (borderResult === 'fullyTransparent') {
        return null;
    } else if (borderResult !== 'noTransparentBorder') {
        imageData = await ImageTools.cropToExtent(imageData, borderResult, true);
        imageRect = extentToRect(borderResult);
    }

    const paletteIndexBuffer = await ImageTools.imageToPaletteIndexBuffer(imageData, palette, true);

    return {
        tilePosition,
        imageRect,
        data: paletteIndexBuffer,
    };
}

export async function optimizeTemplate(image: ImageData, position: PixelCoordinates): Promise<OptimizedTemplateTile[]> {
    const coveredTiles = getCoveredRenderTiles({ ...position, width: image.width, height: image.height });

    const optimizedTilesPromises = coveredTiles.map(async (tileCoord) => {
        const tilePixelRect = renderTileToPixelRect({ ...tileCoord, width: 1, height: 1 });
        const tileImageRect = intersection(tilePixelRect, { ...position, width: image.width, height: image.height });
        if (!tileImageRect) {
            // this should never happen
            throw new Error('Tile does not intersect with image, this should never happen');
        }

        const tileImageData = await ImageTools.cropToExtent(image, rectToExtent(tileImageRect), true);

        return optimizeTile(tileCoord, tileImageData, tileImageRect, Platform.colors);
    });

    const optimizedTiles = await Promise.all(optimizedTilesPromises);

    return optimizedTiles
        .filter((tile) => tile != null)
        .map((tile) => ({
            ...tile,
            tilePosition: worldWrapRenderTileCoordinates(tile.tilePosition),
        }));
}
