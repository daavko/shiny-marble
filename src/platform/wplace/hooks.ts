import type { Map as MapLibreInstance } from 'maplibre-gl';
import * as v from 'valibot';
import { addStyle } from '../../dom/styles';
import { rgbBackgroundStyleToRgbaRaw, rgbToRgbaRaw } from '../../util/color';
import { gatherModuleHrefs } from '../../util/modules';
import { hasPropertyOfType, isObject, isObjectAndHasProperty } from '../../util/object';
import type { CanvasPlatform, PixelColor } from '../types';
import wplacePlatformStyle from './style.css';

const colorsExportSchema = v.array(
    v.object({
        name: v.string(),
        rgb: v.tuple([v.number(), v.number(), v.number()]),
    }),
);

export const WPLACE_PLATFORM: CanvasPlatform = {
    insertPlatformStyles() {
        addStyle(wplacePlatformStyle);
    },
    async addMapInstanceHook(resolveMapInstance: (mapInstance: MapLibreInstance) => void): Promise<void> {
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
                }
            }
        }
    },
    async getAvailableColors(): Promise<PixelColor[]> {
        const moduleHrefs = gatherModuleHrefs('./_app/immutable');
        for (const href of moduleHrefs) {
            const module: unknown = await import(href);
            if (!isObject(module)) {
                continue;
            }

            for (const exportedValue of Object.values(module)) {
                if (!isObjectAndHasProperty(exportedValue, 'colors')) {
                    continue;
                }

                const parseResult = v.safeParse(colorsExportSchema, exportedValue.colors);
                if (!parseResult.success) {
                    continue;
                }

                return parseResult.output.map((color) => {
                    if (color.name === 'Transparent') {
                        return {
                            name: color.name,
                            hex: '#00000000',
                            rgba: 0,
                        };
                    }

                    const [r, g, b] = color.rgb;
                    return {
                        name: color.name,
                        hex: `#${color.rgb.map((channel) => channel.toString(16).padStart(2, '0')).join('')}FF`,
                        rgba: rgbToRgbaRaw(r, g, b),
                    };
                });
            }
        }

        throw new Error('Failed to find colors export');
    },
    getCurrentColor(colors: PixelColor[]): PixelColor | null {
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
};
