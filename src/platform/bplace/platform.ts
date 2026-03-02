import { Map as MapLibreInstance } from 'maplibre-gl';
import { el, type HTMLElementChild } from '../../dom/html';
import { rgbBackgroundStyleToRgbaRaw } from '../../util/color';
import { gatherModuleHrefs } from '../../util/modules';
import { hasPropertyOfType, isObject, isObjectAndHasProperty } from '../../util/object';
import type { CanvasPlatform, PixelColor } from '../types';
import { bplaceColorStatsDialogStyle, showColorStatsDialog } from './color-stats-dialog';
import { BPLACE_COLORS } from './colors';
import bplacePlatformStyle from './platform.css';

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

export const BPLACE_PLATFORM: CanvasPlatform = {
    styles: [bplacePlatformStyle, bplaceColorStatsDialogStyle],
    colors: BPLACE_COLORS,
    async addMapInstanceHook(resolveMapInstance): Promise<void> {
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
                    return;
                }
            }
        }

        throw new Error('Failed to find React module with useRef');
    },
    getCurrentColor(colors): PixelColor | null {
        // fixed inset-x-0 z-50 flex flex-col-reverse items-center gap-2 animate-slide-in-up pointer-events-none
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
    renderPlatformSpecificAppViewContent(): HTMLElementChild[] {
        return [
            el('section', [el('h2', { class: 'sm-app-view__section-heading' }, ['Location highlight']), 'soon(tm)']),
            el('hr'),
            el('section', [
                el('h2', ['TEST']),
                el('h2', ['TEST']),
                el('h2', ['TEST']),
                el('h2', ['TEST']),
                el('h2', ['TEST']),
                el('h2', ['TEST']),
                el('h2', ['TEST']),
                el('h2', ['TEST']),
                el('h2', ['TEST']),
                el('h2', ['TEST']),
                el('h2', ['TEST']),
                el('h2', ['TEST']),
                el('h2', ['TEST']),
                el('h2', ['TEST']),
                el('h2', ['TEST']),
                el('h2', ['TEST']),
                el('h2', ['TEST']),
                el('h2', ['TEST']),
                el(
                    'button',
                    {
                        class: ['sm-platform__block-btn', 'sm-app-view__bplace-show-colors'],
                        events: {
                            click: () => {
                                void showColorStatsDialog();
                            },
                        },
                    },
                    ['Show my color stats'],
                ),
            ]),
        ];
    },
};
