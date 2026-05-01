import { Platform } from '../platform/platform';
import {
    type Coordinates,
    type Dimensions,
    type Extent,
    type MapTileCoordinates,
    mapTileCoordinates,
    type MapTileExtent,
    type PixelCoordinates,
    pixelCoordinates,
    type PixelDimensions,
    pixelDimensions,
    type PixelRect,
    pixelRect,
    type Rect,
    rectToExtent,
    type RenderTileCoordinates,
    renderTileCoordinates,
    type RenderTileDimensions,
    type RenderTileExtent,
    type RenderTileRect,
} from './geometry-basic';
import { brand, type Brand } from './types';

export function pixelToMapTileCoordinates(coords: PixelCoordinates): MapTileCoordinates {
    return mapTileCoordinates({
        x: Math.floor(coords.x / Platform.mapTilePixelDimensions.width),
        y: Math.floor(coords.y / Platform.mapTilePixelDimensions.height),
    });
}

export function mapTileToPixelCoordinates(coords: MapTileCoordinates): PixelCoordinates {
    return pixelCoordinates({
        x: coords.x * Platform.mapTilePixelDimensions.width,
        y: coords.y * Platform.mapTilePixelDimensions.height,
    });
}

export function renderTileToPixelCoordinates(coords: RenderTileCoordinates): PixelCoordinates {
    return pixelCoordinates({
        x: coords.x * Platform.renderTilePixelDimensions.width,
        y: coords.y * Platform.renderTilePixelDimensions.height,
    });
}

export function renderTileToPixelDimensions(dimensions: RenderTileDimensions): PixelDimensions {
    return pixelDimensions({
        width: dimensions.width * Platform.renderTilePixelDimensions.width,
        height: dimensions.height * Platform.renderTilePixelDimensions.height,
    });
}

export function renderTileToPixelRect(rect: RenderTileRect): PixelRect {
    return {
        ...renderTileToPixelCoordinates(rect),
        ...renderTileToPixelDimensions(rect),
    };
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

/**
 * assumes the extent is smaller than world size and therefore handles only a single wrap
 */
export function splitWorldWrappingPixelRect(rect: PixelRect): [PixelRect, PixelRect | null] {
    if (rect.x + rect.width <= Platform.canvasPixelDimensions.width) {
        return [rect, null];
    } else {
        const leftRect = pixelRect({
            x: rect.x,
            y: rect.y,
            width: Platform.canvasPixelDimensions.width - rect.x,
            height: rect.height,
        });
        const rightRect = pixelRect({
            x: 0,
            y: rect.y,
            width: rect.width - leftRect.width,
            height: rect.height,
        });
        return [leftRect, rightRect];
    }
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

/**
 * NEVER USE WITH A RECT THAT CROSSES THE WORLD SEAM
 */
export function getCoveredMapTilesExtent(rect: PixelRect): MapTileExtent {
    const topLeftTile = pixelToMapTileCoordinates(rect);
    const bottomRightTile = pixelToMapTileCoordinates(
        pixelCoordinates({ x: rect.x + rect.width, y: rect.y + rect.height }),
    );

    return brand({
        minX: topLeftTile.x,
        minY: topLeftTile.y,
        maxX: bottomRightTile.x,
        maxY: bottomRightTile.y,
    });
}

/**
 * NEVER USE WITH A RECT THAT CROSSES THE WORLD SEAM
 */
export function coveredTilesExtentToTiles(extent: MapTileExtent): MapTileCoordinates[] {
    const tiles: MapTileCoordinates[] = [];
    for (let tileY = extent.minY; tileY <= extent.maxY; tileY++) {
        for (let tileX = extent.minX; tileX <= extent.maxX; tileX++) {
            tiles.push(mapTileCoordinates({ x: tileX, y: tileY }));
        }
    }
    return tiles;
}

/**
 * IGNORES WORLD WRAPPING, results need to be world-wrapped if necessary
 */
export function getCoveredRenderTilesExtent(rect: PixelRect): RenderTileExtent {
    const topLeftTile = pixelToMapTileCoordinates(rect);
    const bottomRightTile = pixelToMapTileCoordinates(
        pixelCoordinates({ x: rect.x + rect.width, y: rect.y + rect.height }),
    );

    return brand({
        minX: topLeftTile.x,
        minY: topLeftTile.y,
        maxX: bottomRightTile.x,
        maxY: bottomRightTile.y,
    });
}

/**
 * IGNORES WORLD WRAPPING, results need to be world-wrapped if necessary
 */
export function coveredRenderTilesExtentToTiles(extent: RenderTileExtent): RenderTileCoordinates[] {
    const tiles: RenderTileCoordinates[] = [];
    for (let tileY = extent.minY; tileY <= extent.maxY; tileY++) {
        for (let tileX = extent.minX; tileX <= extent.maxX; tileX++) {
            tiles.push(renderTileCoordinates({ x: tileX, y: tileY }));
        }
    }
    return tiles;
}

/**
 * IGNORES WORLD WRAPPING, results need to be world-wrapped if necessary
 */
export function getCoveredRenderTiles(rect: PixelRect): RenderTileCoordinates[] {
    return coveredRenderTilesExtentToTiles(getCoveredRenderTilesExtent(rect));
}

export function worldWrapRenderTileCoordinates(coords: RenderTileCoordinates): RenderTileCoordinates {
    const wrappedX =
        ((coords.x % Platform.canvasRenderTileDimensions.width) + Platform.canvasRenderTileDimensions.width) %
        Platform.canvasRenderTileDimensions.width;
    return renderTileCoordinates({ x: wrappedX, y: coords.y });
}

export function worldWrapPixelCoordinates(coords: PixelCoordinates): PixelCoordinates {
    const wrappedX =
        ((coords.x % Platform.canvasPixelDimensions.width) + Platform.canvasPixelDimensions.width) %
        Platform.canvasPixelDimensions.width;
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
