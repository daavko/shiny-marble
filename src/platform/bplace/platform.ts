import { Map as MapLibreInstance } from 'maplibre-gl';
import * as v from 'valibot';
import { debug } from '../../core/debug';
import { el } from '../../core/dom/html';
import { addStyle, addStyles, removeStyle } from '../../core/dom/styles';
import { originalFetch } from '../../core/fetch';
import { renderBlockButton } from '../../ui/builtin/button';
import { createBooleanSetting, createNumberRangeSetting } from '../../ui/builtin/settings-ui';
import { rgbBackgroundStyleToRgbaRaw } from '../../util/color';
import { pixelDimensions } from '../../util/geometry';
import { gatherModuleHrefs } from '../../util/modules';
import { hasPropertyOfType, isObject, isObjectAndHasProperty } from '../../util/object';
import { createSetting, createSettings } from '../settings';
import type { CanvasPlatform } from '../types';
import { bplaceColorStatsDialogStyle, showColorStatsDialog } from './color-stats-dialog';
import { BPLACE_COLORS } from './colors';
import { toggleBplaceAnalyticsBlocker } from './misc/analytics-block';
import { toggleBplaceFakeBeta } from './misc/fake-beta';
import bplacePlatformStyle from './platform.css';
import hideAchievementConfettiStyle from './toggleable-styles/hide-achievement-confetti.css';
import hideBuyChromasButtonStyle from './toggleable-styles/hide-buy-chromas-btn.css';
import hideGuildNotificationBadgeStyle from './toggleable-styles/hide-guild-notification-badge.css';

interface RefObject {
    current: unknown;
}
type UseRefFn = (...args: unknown[]) => RefObject;

function cleanupPatchedRefs(patchedRefs: Set<WeakRef<RefObject>>): void {
    for (const patchedRef of patchedRefs) {
        const refObj = patchedRef.deref();
        if (refObj) {
            const val = refObj.current;
            Object.defineProperty(refObj, 'current', {
                value: val,
                configurable: true,
                enumerable: true,
                writable: true,
            });
        }
    }
    patchedRefs.clear();
}

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

const bplaceTileNotFoundResponse = v.object({
    statusCode: v.literal('404'),
});

export const BplacePlatform: CanvasPlatform = {
    id: 'bplace',
    colors: BPLACE_COLORS,
    colorsVersion: 1,
    canvasPixelDimensions: pixelDimensions({ width: 1335834, height: 1335834 }),
    tilePixelDimensions: pixelDimensions({ width: 512, height: 512 }),
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
        const moduleHrefs = gatherModuleHrefs('/assets/');
        for (const href of moduleHrefs) {
            const module: unknown = await import(href);
            if (!isObject(module)) {
                continue;
            }

            for (const exportedValue of Object.values(module)) {
                if (!isObject(exportedValue)) {
                    continue;
                }

                if (
                    hasPropertyOfType(exportedValue, 'Fragment', 'symbol') &&
                    hasPropertyOfType(exportedValue, 'Profiler', 'symbol') &&
                    hasPropertyOfType(exportedValue, 'StrictMode', 'symbol') &&
                    hasPropertyOfType(exportedValue, 'Suspense', 'symbol') &&
                    hasPropertyOfType(exportedValue, '__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED', 'object') &&
                    hasPropertyOfType(exportedValue, 'version', 'string') &&
                    hasPropertyOfType(exportedValue, 'useRef', 'function')
                ) {
                    const propertyDescriptor = Object.getOwnPropertyDescriptor(exportedValue, 'useRef');
                    if (propertyDescriptor == null || propertyDescriptor.configurable === false) {
                        continue;
                    }

                    const patchedRefs = new Set<WeakRef<RefObject>>();
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- safe
                    const originalUseRef = exportedValue.useRef as UseRefFn;
                    exportedValue.useRef = (...args: unknown[]): unknown => {
                        const refObject = originalUseRef(...args);
                        const refObjectRef = new WeakRef(refObject);
                        patchedRefs.add(refObjectRef);
                        let val = refObject.current;
                        Object.defineProperty(refObject, 'current', {
                            get: () => val,
                            set: (newVal) => {
                                val = newVal;
                                if (
                                    isObjectAndHasProperty(newVal, '_canvas') &&
                                    newVal._canvas instanceof HTMLCanvasElement
                                ) {
                                    exportedValue.useRef = originalUseRef;
                                    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- safe
                                    const mapInstance = newVal as MapLibreInstance;
                                    const newMap = new MapLibreInstance({
                                        container: mapInstance._container,
                                        style: '/styles/bplace_style.json',
                                        center: mapInstance.getCenter(),
                                        zoom: mapInstance.getZoom(),
                                        bearing: mapInstance.getBearing(),
                                        pitch: mapInstance.getPitch(),
                                        attributionControl: false,
                                        doubleClickZoom: false,
                                        dragRotate: false,
                                        pitchWithRotate: false,
                                        touchPitch: false,
                                        pixelRatio: Math.min(window.devicePixelRatio, 2),
                                        maxZoom: 19,
                                        fadeDuration: 0,
                                        refreshExpiredTiles: false,
                                        canvasContextAttributes: {
                                            preserveDrawingBuffer: true,
                                        },
                                    });
                                    debug('Map instance detected, replacing with own instance', mapInstance, newMap);
                                    newMap.touchZoomRotate.disableRotation();
                                    newMap.keyboard.disableRotation();
                                    mapInstance.remove();

                                    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- safe
                                    const mapInstancePrototype = Object.getPrototypeOf(mapInstance) as object;
                                    const prototypeProxy = new Proxy(mapInstancePrototype, {
                                        get(target, prop, receiver: unknown): unknown {
                                            const value = Reflect.get(target, prop, receiver) as unknown;
                                            if (typeof value === 'function') {
                                                return (...fnArgs: unknown[]) => {
                                                    return Reflect.apply(
                                                        // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type,@typescript-eslint/no-unsafe-type-assertion -- safe
                                                        newMap[prop as keyof MapLibreInstance] as Function,
                                                        newMap,
                                                        fnArgs,
                                                    ) as unknown;
                                                };
                                            } else {
                                                return Reflect.get(newMap, prop);
                                            }
                                        },
                                        set(target, prop, value, receiver): boolean {
                                            return Reflect.set(target, prop, value, receiver);
                                        },
                                    });
                                    Object.setPrototypeOf(mapInstance, prototypeProxy);
                                    // override all own properties to point to the new map instance
                                    for (const key of Object.keys(mapInstance)) {
                                        const mapPropertyDescriptor = Object.getOwnPropertyDescriptor(mapInstance, key);
                                        if (mapPropertyDescriptor == null) {
                                            continue;
                                        }

                                        if (typeof mapPropertyDescriptor.value === 'function') {
                                            Object.defineProperty(mapInstance, key, {
                                                value: (...fnArgs: unknown[]) => {
                                                    Reflect.apply(
                                                        // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type,@typescript-eslint/no-unsafe-type-assertion -- safe
                                                        newMap[key as keyof MapLibreInstance] as Function,
                                                        newMap,
                                                        fnArgs,
                                                    );
                                                },
                                                configurable: true,
                                                enumerable: true,
                                            });
                                        } else {
                                            Object.defineProperty(mapInstance, key, {
                                                get: () => {
                                                    return Reflect.get(newMap, key) as unknown;
                                                },
                                                set: (newPropVal: unknown) => {
                                                    Reflect.set(newMap, key, newPropVal);
                                                },
                                                configurable: true,
                                                enumerable: true,
                                            });
                                        }
                                    }

                                    val = newMap;
                                    cleanupPatchedRefs(patchedRefs);
                                    resolveMapInstance(newMap);
                                }
                            },
                            configurable: true,
                            enumerable: true,
                        });
                        return refObject;
                    };
                    debug('Patched useRef in React module', href, exportedValue);
                    return;
                }
            }
        }

        throw new Error('Failed to find React module with useRef');
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
        // https://tiles.bplace.art/tile-images/X_Y.png
        // returns a 400 with a json error if the tile doesn't exist
        const url = `https://tiles.bplace.art/tile-images/${tileCoords.x}_${tileCoords.y}.png`;
        const response = await originalFetch(url);
        if (!response.ok) {
            if (response.status === 400) {
                try {
                    const errorData: unknown = await response.json();
                    const parseResult = v.safeParse(bplaceTileNotFoundResponse, errorData);
                    if (parseResult.success) {
                        return null;
                    }
                } catch {
                    throw new Error(
                        `Failed to parse error response for tile image: ${response.status} ${response.statusText}`,
                    );
                }
            }
            throw new Error(`Failed to fetch tile image: ${response.status} ${response.statusText}`);
        }

        const blob = await response.blob();
        return await createImageBitmap(blob);
    },
};
