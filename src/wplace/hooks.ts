import type { Map as MapLibreInstance } from 'maplibre-gl';

let mapInstance: MapLibreInstance | null = null;
let hookAdded = false;
const { resolve: resolveMapInstance, promise: mapInstancePromise } = Promise.withResolvers<MapLibreInstance>();

function isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value != null;
}

function isObjectAndHasProperty<PropertyName extends string>(
    value: unknown,
    property: PropertyName,
): value is Record<PropertyName, unknown> {
    return isObject(value) && Reflect.has(value, property);
}

export async function addMapInstanceHook(): Promise<void> {
    if (hookAdded) {
        return;
    }

    hookAdded = true;
    const moduleLinks = document.querySelectorAll('link[rel="modulepreload"]');
    for (const link of moduleLinks) {
        const href = link.getAttribute('href');
        if (href?.startsWith('./_app/immutable') === true) {
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

                if (isObjectAndHasProperty(valuePrototype, 'capture')) {
                    const originalCapture = valuePrototype.capture;
                    if (typeof originalCapture !== 'function') {
                        continue;
                    }

                    valuePrototype.capture = function (this: unknown, ...args: unknown[]): unknown {
                        const firstArg = args.at(0);
                        if (
                            isObjectAndHasProperty(firstArg, 'v') &&
                            isObjectAndHasProperty(firstArg.v, '_canvas') &&
                            firstArg.v._canvas instanceof HTMLCanvasElement
                        ) {
                            // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- safe due to checks
                            mapInstance = firstArg.v as MapLibreInstance;
                            resolveMapInstance(mapInstance);
                            valuePrototype.capture = originalCapture;
                        }

                        return originalCapture.apply(this, args) as unknown;
                    };
                }
            }
        }
    }
}

export async function waitForMapInstance(): Promise<MapLibreInstance> {
    return mapInstancePromise;
}
