import type { PixelColor } from '../../platform/types';
import type { Dimensions, Extent, Point } from '../../util/geometry';
import { ImageTools } from '../../workers/image-tools-dispatcher';
import type { FindTransparentBorderResult } from '../../workers/image-tools-types';

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

/**
 * Get a list of tile coordinates (in tile coordinate space) that are covered by the template
 */
function getCoveredTiles(position: Point, tileSize: Dimensions, templateDimensions: Dimensions): Point[] {
    // todo: make this work for east-west world wrapping

    const coveredTiles: Point[] = [];
    const startTileX = Math.floor(position.x / tileSize.width);
    const startTileY = Math.floor(position.y / tileSize.height);
    const endTileX = Math.ceil((position.x + templateDimensions.width) / tileSize.width);
    const endTileY = Math.ceil((position.y + templateDimensions.height) / tileSize.height);

    for (let tileY = startTileY; tileY < endTileY; tileY++) {
        for (let tileX = startTileX; tileX < endTileX; tileX++) {
            coveredTiles.push({ x: tileX, y: tileY });
        }
    }

    return coveredTiles;
}

interface CroppedTile {
    position: Point;
    imageExtent: Extent;
    imageData: ImageData;
    borderResult: FindTransparentBorderResult;
}

async function coveredTilesToCroppedTiles(
    coveredTiles: Point[],
    position: Point,
    tileSize: Dimensions,
    image: ImageData,
): Promise<CroppedTile[]> {
    const croppedTilesPromises: Promise<CroppedTile>[] = [];
    for (const tile of coveredTiles) {
        const tilePixelX = tile.x * tileSize.width;
        const tilePixelY = tile.y * tileSize.height;

        // intersection of tile extent and image extent, in pixel coordinates
        const tileImageExtent: Extent = {
            minX: Math.max(0, position.x - tilePixelX),
            minY: Math.max(0, position.y - tilePixelY),

            // todo: verify this math
            maxX: Math.min(tilePixelX + tileSize.width, position.x + image.width),
            maxY: Math.min(tilePixelY + tileSize.height, position.y + image.height),
        };

        const tileImageData = ImageTools.cropToArea(image, tileImageExtent);
        const borderResultPromise = ImageTools.findTransparentBorder(tileImageData);

        croppedTilesPromises.push(
            borderResultPromise.then((borderResult) => ({
                position: {
                    x: tilePixelX,
                    y: tilePixelY,
                },
                imageExtent: tileImageExtent,
                imageData: tileImageData,
                borderResult,
            })),
        );
    }
    return Promise.all(croppedTilesPromises);
}

interface RawTile {
    position: Point;
    image: ImageData;
}

function croppedTileToRawTile(croppedTile: CroppedTile): RawTile | null {
    const { position, imageExtent, imageData, borderResult } = croppedTile;
    if (borderResult === 'fullyTransparent') {
        // skip fully transparent tiles, we don't need to store them at all
        return null;
    } else if (borderResult === 'noTransparentBorder') {
        return {
            position: {
                x: position.x + imageExtent.minX,
                y: position.y + imageExtent.minY,
            },
            image: imageData,
        };
    } else {
        const croppedTileImageData = ImageTools.cropToArea(imageData, borderResult);
        return {
            position: {
                x: position.x + imageExtent.minX + borderResult.minX,
                y: position.y + imageExtent.minY + borderResult.minY,
            },
            image: croppedTileImageData,
        };
    }
}

export async function optimizeTemplate(
    image: ImageData,
    position: Point,
    tileSize: Dimensions,
    palette: readonly PixelColor[],
): Promise<OptimizedTemplateData> {
    const coveredTiles = getCoveredTiles(position, tileSize, { width: image.width, height: image.height });

    const croppedTiles = await coveredTilesToCroppedTiles(coveredTiles, position, tileSize, image);

    const rawTiles = croppedTiles.map((tile) => croppedTileToRawTile(tile)).filter((tile) => tile !== null);

    // todo: finish this
}
