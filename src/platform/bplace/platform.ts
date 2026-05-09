import { el } from '../../core/dom/html';
import { addStyle, addStyles, removeStyle } from '../../core/dom/styles';
import { renderBlockButton } from '../../ui/builtin/button';
import { createBooleanSetting, createNumberRangeSetting } from '../../ui/builtin/settings-ui';
import { rgbBackgroundStyleToRgbaRaw } from '../../util/color';
import { pixelDimensions, renderTileDimensions } from '../../util/geometry';
import { coveredTilesExtentToTiles } from '../geometry';
import { globalWatch } from '../reactivity/effects';
import type { CanvasPlatform } from '../types';
import { bplaceColorStatsDialogStyle, showColorStatsDialog } from './color-stats-dialog';
import { BPLACE_COLORS } from './colors';
import { addBplaceMapInstanceHook } from './hooks';
import { toggleBplaceAnalyticsBlocker } from './misc/analytics-block';
import { toggleBplaceFakeBeta } from './misc/fake-beta';
import { toggleBplaceNotificationFilter } from './misc/notification-filter';
import bplacePlatformStyle from './platform.css';
import { BplaceSettings } from './settings';
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

export const BplacePlatform: CanvasPlatform = {
    id: 'bplace',
    colors: BPLACE_COLORS,
    colorsVersion: 1,
    canvasPixelDimensions: pixelDimensions({ width: 1335834, height: 1335834 }),
    canvasRenderTileDimensions: renderTileDimensions({ width: 1335834 / 846, height: 1335834 / 846 }),
    mapTilePixelDimensions: pixelDimensions({ width: 512, height: 512 }),
    renderTilePixelDimensions: pixelDimensions({ width: 846, height: 846 }),
    async initialize() {
        await BplaceSettings.init();

        addStyles(bplacePlatformStyle, bplaceColorStatsDialogStyle);
        globalWatch(
            [BplaceSettings.hideAchievementConfetti],
            ([value]) => toggleStylesheet(hideAchievementConfettiStyle, value),
            true,
        );
        globalWatch(
            [BplaceSettings.hideBuyChromasButton],
            ([value]) => toggleStylesheet(hideBuyChromasButtonStyle, value),
            true,
        );
        globalWatch(
            [BplaceSettings.hideGuildNotificationBadge],
            ([value]) => toggleStylesheet(hideGuildNotificationBadgeStyle, value),
            true,
        );

        globalWatch([BplaceSettings.blockAnalytics], ([value]) => toggleBplaceAnalyticsBlocker(value), true);
        globalWatch([BplaceSettings.fakeBetaTester], ([value]) => toggleBplaceFakeBeta(value), true);

        globalWatch(
            [
                BplaceSettings.showGuildPinContributorNotification,
                BplaceSettings.showPinPublishedNotification,
                BplaceSettings.showPinCollabAcceptedNotification,
            ],
            ([
                showGuildPinContributorNotification,
                showPinPublishedNotification,
                showPinCollabAcceptedNotification,
            ]) => {
                toggleBplaceNotificationFilter(
                    !(
                        showGuildPinContributorNotification &&
                        showPinPublishedNotification &&
                        showPinCollabAcceptedNotification
                    ),
                );
            },
            true,
        );
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
                    BplaceSettings.enableDailyLocationHighlight,
                    'Enable daily location highlight',
                    context,
                ),
                createNumberRangeSetting(
                    BplaceSettings.dailyLocationHighlightOpacity,
                    'Daily location highlight opacity',
                    context,
                    { min: 0, max: 1, step: 0.05 },
                ),
                createBooleanSetting(BplaceSettings.blockAnalytics, 'Block analytics requests', context),
                createBooleanSetting(
                    BplaceSettings.fakeBetaTester,
                    'Fake being a beta tester (requires reload)',
                    context,
                ),
            ]),
            el('section', { class: 'sm-settings__section' }, [
                el('h2', ['Bplace toggleable styles']),
                createBooleanSetting(BplaceSettings.hideAchievementConfetti, 'Hide achievement confetti', context),
                createBooleanSetting(BplaceSettings.hideBuyChromasButton, 'Hide "buy chromas" button', context),
                createBooleanSetting(
                    BplaceSettings.hideGuildNotificationBadge,
                    'Hide guild notification badge',
                    context,
                ),
            ]),
            el('section', { class: 'sm-settings__section' }, [
                el('h2', ['Bplace notification filters']),
                createBooleanSetting(
                    BplaceSettings.showGuildPinContributorNotification,
                    'Show "guild pin contributor" notifications',
                    context,
                ),
                createBooleanSetting(
                    BplaceSettings.showPinPublishedNotification,
                    'Show "pin published" notifications',
                    context,
                ),
                createBooleanSetting(
                    BplaceSettings.showPinCollabAcceptedNotification,
                    'Show "pin collab accepted" notifications',
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
        const tilesCoordsList = coveredTilesExtentToTiles(extent);

        const fetchPromises = tilesCoordsList.map((tileCoords) => {
            const tileInfo = tilesInfo.find((info) => info.tile_x === tileCoords.x && info.tile_y === tileCoords.y);
            return {
                tileCoords,
                tileBitmapPromise: tileInfo ? fetchSingleTileImage(tileCoords, tileInfo.last_rendered_at) : null,
            };
        });
        for (const { tileCoords, tileBitmapPromise } of fetchPromises) {
            yield { tileCoords, tileBitmap: await tileBitmapPromise };
        }
    },
};
