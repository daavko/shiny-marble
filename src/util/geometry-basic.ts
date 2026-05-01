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
