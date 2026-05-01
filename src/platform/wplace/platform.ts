import { addStyle } from '../../core/dom/styles';
import { originalFetch } from '../../core/fetch';
import { rgbBackgroundStyleToRgbaRaw } from '../../util/color';
import { pixelDimensions, renderTileDimensions } from '../../util/geometry';
import { coveredTilesExtentToTiles } from '../geometry';
import type { CanvasPlatform } from '../types';
import { WPLACE_COLORS } from './colors';
import { addWplaceMapInstanceHook } from './hooks';
import wplacePlatformStyle from './platform.css';

export const WplacePlatform: CanvasPlatform = {
    id: 'wplace',
    colors: WPLACE_COLORS,
    colorsVersion: 1,
    canvasPixelDimensions: pixelDimensions({ width: 2048000, height: 2048000 }),
    canvasRenderTileDimensions: renderTileDimensions({ width: 2048000 / 1000, height: 2048000 / 1000 }),
    mapTilePixelDimensions: pixelDimensions({ width: 1000, height: 1000 }),
    renderTilePixelDimensions: pixelDimensions({ width: 1000, height: 1000 }),
    initialize(): void {
        addStyle(wplacePlatformStyle);
    },
    async addMapInstanceHook(resolveMapInstance) {
        await addWplaceMapInstanceHook(resolveMapInstance);
    },
    getCurrentColor(colors) {
        const bottomPane = document.querySelector('div.absolute.bottom-0.left-0');
        const selectedColorElement = bottomPane?.querySelector(
            'div.grid > div.tooltip[data-tip] > button[aria-label].border-primary.ring-primary',
        );

        if (!selectedColorElement || !(selectedColorElement instanceof HTMLElement)) {
            return null;
        }

        const backgroundColor = selectedColorElement.style.backgroundColor;
        if (backgroundColor === '') {
            return colors.find((color) => color.name === 'Transparent') ?? null;
        }

        const rgba = rgbBackgroundStyleToRgbaRaw(backgroundColor);
        if (rgba === null) {
            return null;
        } else {
            return colors.find((color) => color.rgba === rgba) ?? null;
        }
    },
    renderPlatformSpecificAppViewContent() {
        return null;
    },
    renderPlatformSpecificSettingsContent() {
        return null;
    },
    async fetchTileImage(tileCoords) {
        // https://backend.wplace.live/files/s0/tiles/X/Y.png
        // always returns a tile, even if it's transparent
        const url = `https://backend.wplace.live/files/s0/tiles/${tileCoords.x}/${tileCoords.y}.png`;
        const response = await originalFetch(url);
        if (!response.ok) {
            throw new Error(`Failed to fetch tile image: ${response.status} ${response.statusText}`);
        }

        const blob = await response.blob();
        return await createImageBitmap(blob);
    },
    async *createTilesRegionGenerator(extent) {
        const tileCoordsList = coveredTilesExtentToTiles(extent);
        const fetchPromises = tileCoordsList.map((tileCoords) => ({
            tileCoords,
            tileBitmapPromise: WplacePlatform.fetchTileImage(tileCoords),
        }));
        for (const { tileCoords, tileBitmapPromise } of fetchPromises) {
            yield {
                tileCoords,
                tileBitmap: await tileBitmapPromise,
            };
        }
    },
};
