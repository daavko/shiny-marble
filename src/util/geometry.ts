import { brand, type Brand } from './types';

export interface Coordinates {
    x: number;
    y: number;
}

export interface Dimensions {
    width: number;
    height: number;
}

/**
 * an area defined by top-left corner, width and height, *not inclusive* of the right and bottom edges
 */
export interface Rect extends Coordinates, Dimensions {}

/**
 * an *inclusive* area defined by min and max coordinates
 */
export interface Extent {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
}

type PixelBrand = 'Pixel';
/**
 * this coordinate system can never wrap, because bplace is a pile of garbage and has 2609,05078125 tiles in the x direction
 * it can also never exist as dimensions or extent, for the same damn reason
 *
 * which fucking moron decided that "30 meters per pixel" is a better choice than "a round number of tiles in the damn world"
 */
type MapTileBrand = 'MapTile';
type RenderTileBrand = 'RenderTile';

export type PixelCoordinates = Brand<Coordinates, PixelBrand>;
export type MapTileCoordinates = Brand<Coordinates, MapTileBrand>;
export type RenderTileCoordinates = Brand<Coordinates, RenderTileBrand>;

export type PixelDimensions = Brand<Dimensions, PixelBrand>;
export type RenderTileDimensions = Brand<Dimensions, RenderTileBrand>;

export type PixelRect = Brand<Rect, PixelBrand>;
export type RenderTileRect = Brand<Rect, RenderTileBrand>;

export type PixelExtent = Brand<Extent, PixelBrand>;
export type MapTileExtent = Brand<Extent, MapTileBrand>;
export type RenderTileExtent = Brand<Extent, RenderTileBrand>;

export function pixelCoordinates(coords: Coordinates): PixelCoordinates {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- safe
    return coords as PixelCoordinates;
}

export function mapTileCoordinates(coords: Coordinates): MapTileCoordinates {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- safe
    return coords as MapTileCoordinates;
}

export function renderTileCoordinates(coords: Coordinates): RenderTileCoordinates {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- safe
    return coords as RenderTileCoordinates;
}

export function pixelDimensions(dimensions: Dimensions): PixelDimensions {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- safe
    return dimensions as PixelDimensions;
}

export function renderTileDimensions(dimensions: Dimensions): RenderTileDimensions {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- safe
    return dimensions as RenderTileDimensions;
}

export function pixelRect(rect: Rect): PixelRect {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- safe
    return rect as PixelRect;
}

export function renderTileRect(rect: Rect): RenderTileRect {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- safe
    return rect as RenderTileRect;
}

export function pixelExtent(extent: Extent): PixelExtent {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- safe
    return extent as PixelExtent;
}

export function renderTileExtent(extent: Extent): RenderTileExtent {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- safe
    return extent as RenderTileExtent;
}
export function rectToExtent<T>(rect: Brand<Rect, T>): Brand<Extent, T> {
    return brand({
        minX: rect.x,
        minY: rect.y,
        maxX: rect.x + rect.width - 1,
        maxY: rect.y + rect.height - 1,
    });
}

export function extentToRect<T>(extent: Brand<Extent, T>): Brand<Rect, T> {
    return brand({
        x: extent.minX,
        y: extent.minY,
        width: extent.maxX - extent.minX + 1,
        height: extent.maxY - extent.minY + 1,
    });
}

/**
 * returns a MINIMAL rectangle that contains both corners
 */
export function cornersToRect<T>(
    corner1: Brand<Coordinates, T>,
    corner2: Brand<Coordinates, T>,
    worldSize: PixelDimensions,
): Brand<Rect, T> {
    let minX = Math.min(corner1.x, corner2.x);
    let maxX = Math.max(corner1.x, corner2.x);
    const minY = Math.min(corner1.y, corner2.y);
    const maxY = Math.max(corner1.y, corner2.y);

    if (maxX - minX > worldSize.width / 2) {
        [minX, maxX] = [maxX, minX + worldSize.width];
    }

    return brand({ x: minX, y: minY, width: maxX - minX, height: maxY - minY });
}

/**
 * IGNORES WORLD WRAPPING, results need to be world-wrapped if necessary
 *
 * order of corners in returned array is top-left, top-right, bottom-left, bottom-right
 */
export function rectToAllCorners<T>(
    rect: Brand<Rect, T>,
): [Brand<Coordinates, T>, Brand<Coordinates, T>, Brand<Coordinates, T>, Brand<Coordinates, T>] {
    return [
        brand({ x: rect.x, y: rect.y }),
        brand({ x: rect.x + rect.width, y: rect.y }),
        brand({ x: rect.x, y: rect.y + rect.height }),
        brand({ x: rect.x + rect.width, y: rect.y + rect.height }),
    ];
}

export function extentSize<T>(extent: Brand<Extent, T>): Brand<Dimensions, T> {
    return brand({
        width: extent.maxX - extent.minX + 1,
        height: extent.maxY - extent.minY + 1,
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

export function coordsWithNewOrigin<T>(
    coordinates: Brand<Coordinates, T>,
    origin: Brand<Coordinates, T>,
): Brand<Coordinates, T> {
    return brand({
        x: coordinates.x - origin.x,
        y: coordinates.y - origin.y,
    });
}
