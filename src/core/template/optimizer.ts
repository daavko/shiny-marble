import type { PixelColor } from '../../platform/types';
import {
    extentToRect,
    getCoveredTiles,
    intersection,
    type PixelCoordinates,
    type PixelDimensions,
    type PixelRect,
    rectToExtent,
    type TileCoordinates,
    type TileRect,
    tileToPixelRect,
} from '../../util/geometry';
import { ImageTools } from '../../workers/image-tools-dispatcher';
import type { FindTransparentBorderResult } from '../../workers/image-tools-types';

export interface OptimizedTemplateTile {
    /**
     * tile position in tile coordinates
     */
    tile: TileCoordinates;

    /**
     * position within the tile in pixel coordinates
     */
    position: PixelCoordinates;

    /**
     * dimensions of the compressed data in pixel coordinates
     */
    dimensions: PixelDimensions;

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

interface CroppedTile {
    imageData: ImageData;
    imageRect: PixelRect;
    borderResult: FindTransparentBorderResult;
}

async function coveredTilesToCroppedTiles(
    coveredTiles: TileRect[],
    position: PixelCoordinates,
    tileSize: PixelDimensions,
    image: ImageData,
): Promise<CroppedTile[]> {
    const croppedTilesPromises: Promise<CroppedTile>[] = [];
    for (const tile of coveredTiles) {
        const pixelTile = tileToPixelRect(tile, tileSize);
        const tileImageRect = intersection(pixelTile, { ...position, width: image.width, height: image.height });
        if (!tileImageRect) {
            // this should never happen
            throw new Error('Tile does not intersect with image, this should never happen');
        }

        const tileImageExtent = rectToExtent(tileImageRect);

        const tileImageData = ImageTools.cropToArea(image, tileImageExtent);
        const borderResultPromise = ImageTools.findTransparentBorder(tileImageData);

        croppedTilesPromises.push(
            borderResultPromise.then((borderResult) => ({
                imageData: tileImageData,
                imageRect: tileImageRect,
                borderResult,
            })),
        );
    }
    return Promise.all(croppedTilesPromises);
}

interface RawTile {
    image: ImageData;
    imageRect: PixelRect;
}

function croppedTileToRawTile(croppedTile: CroppedTile): RawTile | null {
    const { imageRect, imageData, borderResult } = croppedTile;
    if (borderResult === 'fullyTransparent') {
        // skip fully transparent tiles, we don't need to store them at all
        return null;
    } else if (borderResult === 'noTransparentBorder') {
        return {
            imageRect,
            image: imageData,
        };
    } else {
        const croppedTileImageData = ImageTools.cropToArea(imageData, borderResult);
        return {
            image: croppedTileImageData,
            imageRect: extentToRect(borderResult),
        };
    }
}

export async function optimizeTemplate(
    image: ImageData,
    position: PixelCoordinates,
    tileSize: PixelDimensions,
    palette: readonly PixelColor[],
): Promise<OptimizedTemplateData> {
    const coveredTiles = getCoveredTiles({ ...position, width: image.width, height: image.height }, tileSize);

    const croppedTiles = await coveredTilesToCroppedTiles(coveredTiles, position, tileSize, image);

    const rawTiles = croppedTiles.map((tile) => croppedTileToRawTile(tile)).filter((tile) => tile !== null);

    // todo: finish this
}
