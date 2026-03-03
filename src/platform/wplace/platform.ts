import type { Map as MapLibreInstance } from 'maplibre-gl';
import { addStyle } from '../../dom/styles';
import { rgbBackgroundStyleToRgbaRaw } from '../../util/color';
import { gatherModuleHrefs } from '../../util/modules';
import { hasPropertyOfType, isObject, isObjectAndHasProperty } from '../../util/object';
import type { CanvasPlatform } from '../types';
import { WPLACE_COLORS } from './colors';
import wplacePlatformStyle from './platform.css';

export const WplacePlatform: CanvasPlatform = {
    colors: WPLACE_COLORS,
    initialize(): void {
        addStyle(wplacePlatformStyle);
    },
    async addMapInstanceHook(resolveMapInstance) {
        const moduleHrefs = gatherModuleHrefs('./_app/immutable');
        for (const href of moduleHrefs) {
            const module: unknown = await import(href);
            if (!isObject(module)) {
                continue;
            }

            for (const exportedValue of Object.values(module)) {
                if (typeof exportedValue !== 'function') {
                    continue;
                }

                const prototypePropertyDescriptor = Reflect.getOwnPropertyDescriptor(exportedValue, 'prototype');
                if (prototypePropertyDescriptor?.writable !== false) {
                    continue;
                }
                const valuePrototype = prototypePropertyDescriptor.value as unknown;

                if (isObject(valuePrototype) && hasPropertyOfType(valuePrototype, 'capture', 'function')) {
                    const originalCapture = valuePrototype.capture;

                    valuePrototype.capture = function (this: unknown, ...args: unknown[]): unknown {
                        const firstArg = args.at(0);
                        if (
                            isObjectAndHasProperty(firstArg, 'v') &&
                            isObjectAndHasProperty(firstArg.v, '_canvas') &&
                            firstArg.v._canvas instanceof HTMLCanvasElement
                        ) {
                            // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- safe due to checks
                            resolveMapInstance(firstArg.v as MapLibreInstance);
                            valuePrototype.capture = originalCapture;
                        }

                        return originalCapture.apply(this, args);
                    };
                    return;
                }
            }
        }
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
};
