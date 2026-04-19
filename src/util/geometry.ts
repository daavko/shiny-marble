import { brand, type Brand } from './types';

interface Coordinates {
    x: number;
    y: number;
}

interface Vector {
    x: number;
    y: number;
}

interface Dimensions {
    width: number;
    height: number;
}

interface Rect extends Coordinates, Dimensions {}

interface Extent {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
}

type PixelBrand = 'Pixel';
type TileBrand = 'Tile';

export type PixelCoordinates = Brand<Coordinates, PixelBrand>;
export type TileCoordinates = Brand<Coordinates, TileBrand>;

export type PixelVector = Brand<Vector, PixelBrand>;

export type PixelDimensions = Brand<Dimensions, PixelBrand>;
export type TileDimensions = Brand<Dimensions, TileBrand>;

export type PixelRect = Brand<Rect, PixelBrand>;
export type TileRect = Brand<Rect, TileBrand>;

export type PixelExtent = Brand<Extent, PixelBrand>;
export type TileExtent = Brand<Extent, TileBrand>;

export function pixelCoordinates(coords: Coordinates): PixelCoordinates {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- safe
    return coords as PixelCoordinates;
}

export function tileCoordinates(coords: Coordinates): TileCoordinates {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- safe
    return coords as TileCoordinates;
}

export function pixelDimensions(dimensions: Dimensions): PixelDimensions {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- safe
    return dimensions as PixelDimensions;
}

export function tileDimensions(dimensions: Dimensions): TileDimensions {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- safe
    return dimensions as TileDimensions;
}

export function pixelRect(rect: Rect): PixelRect {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- safe
    return rect as PixelRect;
}

export function tileRect(rect: Rect): TileRect {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- safe
    return rect as TileRect;
}

export function tileUnitRect(coords: TileCoordinates): TileRect {
    return tileRect({ x: coords.x, y: coords.y, width: 1, height: 1 });
}

export function pixelExtent(extent: Extent): PixelExtent {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- safe
    return extent as PixelExtent;
}

export function tileExtent(extent: Extent): TileExtent {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- safe
    return extent as TileExtent;
}

export function pixelToTileCoordinates(coords: PixelCoordinates, tileSize: PixelDimensions): TileCoordinates {
    return tileCoordinates({
        x: Math.floor(coords.x / tileSize.width),
        y: Math.floor(coords.y / tileSize.height),
    });
}

export function tileToPixelCoordinates(coords: TileCoordinates, tileSize: PixelDimensions): PixelCoordinates {
    return pixelCoordinates({
        x: coords.x * tileSize.width,
        y: coords.y * tileSize.height,
    });
}

export function pixelToTileDimensions(dimensions: PixelDimensions, tileSize: PixelDimensions): TileDimensions {
    return tileDimensions({
        width: Math.ceil(dimensions.width / tileSize.width),
        height: Math.ceil(dimensions.height / tileSize.height),
    });
}

export function tileToPixelDimensions(dimensions: TileDimensions, tileSize: PixelDimensions): PixelDimensions {
    return pixelDimensions({
        width: dimensions.width * tileSize.width,
        height: dimensions.height * tileSize.height,
    });
}

export function tileToPixelRect(rect: TileRect, tileSize: PixelDimensions): PixelRect {
    return {
        ...tileToPixelCoordinates(rect, tileSize),
        ...tileToPixelDimensions(rect, tileSize),
    };
}

export function rectToExtent<T>(rect: Brand<Rect, T>): Brand<Extent, T> {
    return brand({
        minX: rect.x,
        minY: rect.y,
        maxX: rect.x + rect.width,
        maxY: rect.y + rect.height,
    });
}

export function extentToRect<T>(extent: Brand<Extent, T>): Brand<Rect, T> {
    return brand({
        x: extent.minX,
        y: extent.minY,
        width: extent.maxX - extent.minX,
        height: extent.maxY - extent.minY,
    });
}

export function coordsToExtent<T>(coordsArray: Brand<Coordinates, T>[]): Brand<Extent, T> {
    if (coordsArray.length === 0) {
        return brand({ minX: 0, minY: 0, maxX: 0, maxY: 0 });
    }

    const result: Extent = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
    for (const coords of coordsArray) {
        if (coords.x < result.minX) {
            result.minX = coords.x;
        }
        if (coords.y < result.minY) {
            result.minY = coords.y;
        }
        if (coords.x > result.maxX) {
            result.maxX = coords.x;
        }
        if (coords.y > result.maxY) {
            result.maxY = coords.y;
        }
    }
    return brand(result);
}

export function extentSize<T>(extent: Brand<Extent, T>): Brand<Dimensions, T> {
    return brand({
        width: extent.maxX - extent.minX,
        height: extent.maxY - extent.minY,
    });
}

export function enlargeExtentToContainRectMut<T>(extent: Brand<Extent, T>, rect: Brand<Rect, T>): void {
    const rectExtent = rectToExtent(rect);
    extent.minX = Math.min(extent.minX, rectExtent.minX);
    extent.minY = Math.min(extent.minY, rectExtent.minY);
    extent.maxX = Math.max(extent.maxX, rectExtent.maxX);
    extent.maxY = Math.max(extent.maxY, rectExtent.maxY);
}

export function intersects<T>(rect1: Brand<Rect, T>, rect2: Brand<Rect, T>): boolean {
    return (
        rect1.x < rect2.x + rect2.width &&
        rect1.x + rect1.width > rect2.x &&
        rect1.y < rect2.y + rect2.height &&
        rect1.y + rect1.height > rect2.y
    );
}

export function intersection<T>(rect1: Brand<Rect, T>, rect2: Brand<Rect, T>): Brand<Rect, T> | null {
    const minX = Math.max(rect1.x, rect2.x);
    const minY = Math.max(rect1.y, rect2.y);
    const maxX = Math.min(rect1.x + rect1.width, rect2.x + rect2.width);
    const maxY = Math.min(rect1.y + rect1.height, rect2.y + rect2.height);

    const intersectionWidth = maxX - minX;
    const intersectionHeight = maxY - minY;

    if (intersectionWidth <= 0 || intersectionHeight <= 0) {
        return null;
    } else {
        return brand({ x: minX, y: minY, width: intersectionWidth, height: intersectionHeight });
    }
}

/**
 * IGNORES WORLD WRAPPING, results need to be world-wrapped if necessary
 */
export function getCoveredTiles(rect: PixelRect, tileSize: PixelDimensions): TileRect[] {
    const topLeftTile = pixelToTileCoordinates(rect, tileSize);
    const bottomRightTile = pixelToTileCoordinates(
        pixelCoordinates({ x: rect.x + rect.width, y: rect.y + rect.height }),
        tileSize,
    );

    const coveredTiles: TileRect[] = [];
    for (let tileY = topLeftTile.y; tileY <= bottomRightTile.y; tileY++) {
        for (let tileX = topLeftTile.x; tileX <= bottomRightTile.x; tileX++) {
            coveredTiles.push(tileUnitRect(tileCoordinates({ x: tileX, y: tileY })));
        }
    }
    return coveredTiles;
}

export function worldWrapTileCoordinates(
    coords: TileCoordinates,
    tileSize: PixelDimensions,
    worldSize: PixelDimensions,
): TileCoordinates {
    const worldSizeInTiles = pixelToTileDimensions(worldSize, tileSize);
    const wrappedX = ((coords.x % worldSizeInTiles.width) + worldSizeInTiles.width) % worldSizeInTiles.width;
    return tileCoordinates({ x: wrappedX, y: coords.y });
}

export function worldWrapPixelCoordinates(coords: PixelCoordinates, worldSize: PixelDimensions): PixelCoordinates {
    const wrappedX = ((coords.x % worldSize.width) + worldSize.width) % worldSize.width;
    return pixelCoordinates({ x: wrappedX, y: coords.y });
}

export function coordsWithNewOrigin<T>(
    coordinates: Brand<Coordinates, T>,
    origin: Brand<Coordinates, T>,
): Brand<Coordinates, T> {
    return brand({
        x: coordinates.x - origin.x,
        y: coordinates.y - origin.y,
    });
}

export function coordsEqualityFn<T>(
    coords1: Brand<Coordinates, T> | null | undefined,
    coords2: Brand<Coordinates, T> | null | undefined,
): boolean {
    if (coords1 == null || coords2 == null) {
        return coords1 === coords2;
    } else {
        return coords1.x === coords2.x && coords1.y === coords2.y;
    }
}

export function dimensionsEqualityFn<T>(
    dimensions1: Brand<Dimensions, T> | null | undefined,
    dimensions2: Brand<Dimensions, T> | null | undefined,
): boolean {
    if (dimensions1 == null || dimensions2 == null) {
        return dimensions1 === dimensions2;
    } else {
        return dimensions1.width === dimensions2.width && dimensions1.height === dimensions2.height;
    }
}

export function rectsEqualityFn<T>(
    rect1: Brand<Rect, T> | null | undefined,
    rect2: Brand<Rect, T> | null | undefined,
): boolean {
    if (rect1 == null || rect2 == null) {
        return rect1 === rect2;
    } else {
        return (
            rect1.x === rect2.x && rect1.y === rect2.y && rect1.width === rect2.width && rect1.height === rect2.height
        );
    }
}

export function extentsEqualityFn<T>(
    extent1: Brand<Extent, T> | null | undefined,
    extent2: Brand<Extent, T> | null | undefined,
): boolean {
    if (extent1 == null || extent2 == null) {
        return extent1 === extent2;
    } else {
        return (
            extent1.minX === extent2.minX &&
            extent1.minY === extent2.minY &&
            extent1.maxX === extent2.maxX &&
            extent1.maxY === extent2.maxY
        );
    }
}
