import {
    type MapTileCoordinates,
    mapTileCoordinates,
    type MapTileExtent,
    type PixelCoordinates,
    pixelCoordinates,
    type PixelDimensions,
    pixelDimensions,
    type PixelRect,
    pixelRect,
    type RenderTileCoordinates,
    renderTileCoordinates,
    type RenderTileDimensions,
    type RenderTileExtent,
    type RenderTileRect,
} from '../util/geometry';
import { brand } from '../util/types';
import { Platform } from './platform';

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
