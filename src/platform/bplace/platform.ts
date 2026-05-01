import { el } from '../../core/dom/html';
import { addStyle, addStyles, removeStyle } from '../../core/dom/styles';
import { renderBlockButton } from '../../ui/builtin/button';
import { createBooleanSetting, createNumberRangeSetting } from '../../ui/builtin/settings-ui';
import { rgbBackgroundStyleToRgbaRaw } from '../../util/color';
import { pixelDimensions, renderTileDimensions } from '../../util/geometry';
import { coveredTilesExtentToTiles } from '../geometry';
import { createSetting, createSettings } from '../settings';
import type { CanvasPlatform } from '../types';
import { bplaceColorStatsDialogStyle, showColorStatsDialog } from './color-stats-dialog';
import { BPLACE_COLORS } from './colors';
import { addBplaceMapInstanceHook } from './hooks';
import { toggleBplaceAnalyticsBlocker } from './misc/analytics-block';
import { toggleBplaceFakeBeta } from './misc/fake-beta';
import bplacePlatformStyle from './platform.css';
import { fetchTileInfo, fetchTilesInfo } from './supabase';
import { fetchSingleTileImage } from './tiles/tile-fetch';
import hideAchievementConfettiStyle from './toggleable-styles/hide-achievement-confetti.css';
import hideBuyChromasButtonStyle from './toggleable-styles/hide-buy-chromas-btn.css';
import hideGuildNotificationBadgeStyle from './toggleable-styles/hide-guild-notification-badge.css';

function toggleStylesheet(style: string, enabled: boolean): void {
    if (enabled) {
        addStyle(style);
    } else {
        removeStyle(style);
    }
}

const bplaceSettings = createSettings('bplace-platform', 1, {
    enableDailyLocationHighlight: createSetting(true),
    dailyLocationHighlightOpacity: createSetting(0.25),
    hideAchievementConfetti: createSetting(false, [
        (newValue): void => toggleStylesheet(hideAchievementConfettiStyle, newValue),
    ]),
    hideBuyChromasButton: createSetting(false, [
        (newValue): void => toggleStylesheet(hideBuyChromasButtonStyle, newValue),
    ]),
    hideGuildNotificationBadge: createSetting(false, [
        (newValue): void => toggleStylesheet(hideGuildNotificationBadgeStyle, newValue),
    ]),
    blockAnalytics: createSetting(true, [(newValue): void => toggleBplaceAnalyticsBlocker(newValue)]),
    fakeBetaTester: createSetting(false, [(newValue): void => toggleBplaceFakeBeta(newValue)]),
});

export const BplacePlatform: CanvasPlatform = {
    id: 'bplace',
    colors: BPLACE_COLORS,
    colorsVersion: 1,
    canvasPixelDimensions: pixelDimensions({ width: 1335834, height: 1335834 }),
    canvasRenderTileDimensions: renderTileDimensions({ width: 1335834 / 846, height: 1335834 / 846 }),
    mapTilePixelDimensions: pixelDimensions({ width: 512, height: 512 }),
    renderTilePixelDimensions: pixelDimensions({ width: 846, height: 846 }),
    async initialize() {
        await bplaceSettings.init();

        addStyles(bplacePlatformStyle, bplaceColorStatsDialogStyle);
        toggleStylesheet(hideAchievementConfettiStyle, bplaceSettings.hideAchievementConfetti.value);
        toggleStylesheet(hideBuyChromasButtonStyle, bplaceSettings.hideBuyChromasButton.value);
        toggleStylesheet(hideGuildNotificationBadgeStyle, bplaceSettings.hideGuildNotificationBadge.value);

        toggleBplaceAnalyticsBlocker(bplaceSettings.blockAnalytics.value);
        toggleBplaceFakeBeta(bplaceSettings.fakeBetaTester.value);
    },
    async addMapInstanceHook(resolveMapInstance) {
        await addBplaceMapInstanceHook(resolveMapInstance);
    },
    getCurrentColor(colors) {
        const bottomPane = document.querySelector('#root > .w-screen.h-screen > div.fixed.inset-x-0');
        const colorButtonsContainer = bottomPane?.querySelector('.flex.w-full > .flex.flex-wrap.justify-center');
        const selectedColorElement = colorButtonsContainer?.querySelector(
            'button.swatch-appear[class*="ring-"] > div:first-child',
        );

        if (!selectedColorElement || !(selectedColorElement instanceof HTMLElement)) {
            return null;
        }

        if (selectedColorElement.classList.contains('gold-shimmer')) {
            return colors.find((color) => color.name === 'Gold') ?? null;
        } else if (selectedColorElement.classList.contains('silver-shimmer')) {
            return colors.find((color) => color.name === 'Silver') ?? null;
        } else if (selectedColorElement.classList.contains('holographic-shimmer')) {
            return colors.find((color) => color.name === 'Holographic') ?? null;
        } else if (selectedColorElement.classList.contains('dark-holographic-shimmer')) {
            return colors.find((color) => color.name === 'Dark Holographic') ?? null;
        } else if (!selectedColorElement.hasAttribute('style')) {
            // transparent color doesn't have a style attribute
            return colors.find((color) => color.name === 'Transparent') ?? null;
        }

        const backgroundColor = selectedColorElement.style.backgroundColor;
        const rgba = rgbBackgroundStyleToRgbaRaw(backgroundColor);
        if (rgba === null) {
            return null;
        } else {
            return colors.find((color) => color.rgba === rgba) ?? null;
        }
    },
    renderPlatformSpecificAppViewContent() {
        return [
            el('section', [
                el('h2', { class: 'sm-app-view__section-heading' }, ['Bplace utilities']),
                el('div', { class: ['sm-row', 'sm-row--center'] }, [
                    renderBlockButton('Show my color stats', () => void showColorStatsDialog()),
                ]),
            ]),
        ];
    },
    renderPlatformSpecificSettingsContent(context) {
        return [
            el('section', { class: 'sm-settings__section' }, [
                el('h2', ['Bplace-specific settings']),
                createBooleanSetting(
                    bplaceSettings.enableDailyLocationHighlight,
                    'Enable daily location highlight',
                    context,
                ),
                createNumberRangeSetting(
                    bplaceSettings.dailyLocationHighlightOpacity,
                    'Daily location highlight opacity',
                    context,
                    { min: 0, max: 1, step: 0.05 },
                ),
                createBooleanSetting(bplaceSettings.blockAnalytics, 'Block analytics requests', context),
                createBooleanSetting(
                    bplaceSettings.fakeBetaTester,
                    'Fake being a beta tester (requires reload)',
                    context,
                ),
            ]),
            el('section', { class: 'sm-settings__section' }, [
                el('h2', ['Bplace toggleable styles']),
                createBooleanSetting(bplaceSettings.hideAchievementConfetti, 'Hide achievement confetti', context),
                createBooleanSetting(bplaceSettings.hideBuyChromasButton, 'Hide "buy chromas" button', context),
                createBooleanSetting(
                    bplaceSettings.hideGuildNotificationBadge,
                    'Hide guild notification badge',
                    context,
                ),
            ]),
        ];
    },
    async fetchTileImage(tileCoords) {
        const tileInfo = await fetchTileInfo(tileCoords);

        if (!tileInfo) {
            return null;
        }

        return fetchSingleTileImage(tileCoords, tileInfo.last_rendered_at);
    },
    async *createTilesRegionGenerator(extent) {
        const tilesInfo = await fetchTilesInfo(extent);
        const tilesCoords = coveredTilesExtentToTiles(extent);

        for (const tileCoords of tilesCoords) {
            const tileInfo = tilesInfo.find((info) => info.tile_x === tileCoords.x && info.tile_y === tileCoords.y);
            if (!tileInfo) {
                yield { tileCoords, tileBitmap: null };
            } else {
                const tileBitmap = await fetchSingleTileImage(tileCoords, tileInfo.last_rendered_at);
                yield { tileCoords, tileBitmap };
            }
        }
    },
};
