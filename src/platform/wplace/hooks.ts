import type { Map as MapLibreInstance } from 'maplibre-gl';
import { gatherModuleHrefs } from '../../util/modules';
import { hasPropertyOfType, isObject, isObjectAndHasProperty } from '../../util/object';
import { debug } from '../debug';

export async function addWplaceMapInstanceHook(
    resolveMapInstance: (mapInstance: MapLibreInstance) => void,
): Promise<void> {
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
                        const mapInstance = firstArg.v as MapLibreInstance;

                        // workaround for wplace devs being absolute fucking morons and updating the layer order
                        // every single fucking frame, therefore preventing the 'load' event from firing
                        const updateResetInterval = setInterval(() => {
                            if (
                                !mapInstance.loaded() &&
                                // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- actually necessary
                                mapInstance.style?.loaded() &&
                                !mapInstance._sourcesDirty &&
                                mapInstance._styleDirty
                            ) {
                                mapInstance.style._resetUpdates();
                                clearInterval(updateResetInterval);
                            }
                        }, 100);

                        resolveMapInstance(mapInstance);
                        valuePrototype.capture = originalCapture;
                    }

                    return originalCapture.apply(this, args);
                };
                debug('Patched internal Svelte state manager', href, exportedValue);
                return;
            }
        }
    }
}
