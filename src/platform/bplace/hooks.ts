import type { Map as MapLibreInstance } from 'maplibre-gl';
import * as v from 'valibot';
import { addStyle } from '../../dom/styles';
import { rgbBackgroundStyleToRgbaRaw, rgbToRgbaRaw } from '../../util/color';
import { gatherModuleHrefs } from '../../util/modules';
import { hasPropertyOfType, isObject, isObjectAndHasProperty } from '../../util/object';
import type { CanvasPlatform, PixelColor } from '../types';
import bplacePlatformStyle from './style.css';

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

interface SupabaseObject {
    readonly supabaseUrl: string;
    readonly supabaseKey: string;
    readonly changedAccessToken: string;
}

async function findSupabaseObject(): Promise<SupabaseObject> {
    const moduleHrefs = gatherModuleHrefs('/assets/');
    for (const href of moduleHrefs) {
        const module: unknown = await import(href);
        if (!isObject(module)) {
            continue;
        }

        for (const exportedValue of Object.values(module)) {
            if (
                isObject(exportedValue) &&
                hasPropertyOfType(exportedValue, 'supabaseUrl', 'string') &&
                hasPropertyOfType(exportedValue, 'supabaseKey', 'string') &&
                hasPropertyOfType(exportedValue, 'changedAccessToken', 'string')
            ) {
                return exportedValue;
            }
        }
    }

    throw new Error('Supabase object not found in any module');
}

let supabaseObject: SupabaseObject | null = null;
async function getSupabaseObject(): Promise<SupabaseObject> {
    supabaseObject ??= await findSupabaseObject();
    return supabaseObject;
}

async function doSupabaseRequest<T>(
    endpoint: string,
    queryParams: URLSearchParams,
    responseSchema: v.GenericSchema<unknown, T>,
): Promise<T> {
    const { supabaseUrl, supabaseKey, changedAccessToken } = await getSupabaseObject();

    const url = new URL(endpoint, supabaseUrl);
    url.search = queryParams.toString();

    const response = await fetch(url, {
        headers: {
            apikey: supabaseKey,
            Authorization: `Bearer ${changedAccessToken}`,
        },
    });

    if (!response.ok) {
        throw new Error(`Supabase request failed with status ${response.status}`);
    }

    const responseData: unknown = await response.json();
    const parsedResponse = v.safeParse(responseSchema, responseData);
    if (!parsedResponse.success) {
        throw new Error(`Failed to parse Supabase response: ${JSON.stringify(parsedResponse.issues)}`);
    }

    return parsedResponse.output;
}

const colorsResponseSchema = v.array(
    v.pipe(
        v.object({
            name: v.string(),
            hex_value: v.pipe(v.string(), v.regex(/^#[0-9a-fA-F]{6}$/)),
        }),
        v.transform(({ name, hex_value }): PixelColor => {
            const r = parseInt(hex_value.slice(1, 3), 16);
            const g = parseInt(hex_value.slice(3, 5), 16);
            const b = parseInt(hex_value.slice(5, 7), 16);
            return {
                name,
                hex: hex_value + 'FF',
                rgba: rgbToRgbaRaw(r, g, b),
            };
        }),
    ),
);

export const BPLACE_PLATFORM: CanvasPlatform = {
    insertPlatformStyles() {
        addStyle(bplacePlatformStyle);
    },
    async addMapInstanceHook(resolveMapInstance: (mapInstance: MapLibreInstance) => void): Promise<void> {
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
                                    cleanupPatchedRefs(patchedRefs);
                                    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- safe
                                    resolveMapInstance(newVal as MapLibreInstance);
                                }
                            },
                            configurable: true,
                            enumerable: true,
                        });
                        return refObject;
                    };
                }
            }
        }
    },
    async getAvailableColors(): Promise<PixelColor[]> {
        return doSupabaseRequest(
            '/rest/v1/colors',
            new URLSearchParams({
                select: 'name,hex_value',
                order: 'palette_order.asc,shade.asc',
                is_active: 'eq.true',
            }),
            colorsResponseSchema,
        );
    },
    getCurrentColor(colors: PixelColor[]): PixelColor | null {
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
};
