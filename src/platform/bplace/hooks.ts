import type { Map as MapLibreInstance } from 'maplibre-gl';
import { gatherModuleHrefs } from '../../util/modules';
import { hasPropertyOfType, isObject, isObjectAndHasProperty } from '../../util/object';
import { debug } from '../debug';

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

export async function addBplaceMapInstanceHook(
    resolveMapInstance: (mapInstance: MapLibreInstance) => void,
): Promise<void> {
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
                                val = newVal;
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
                debug('Patched useRef in React module', href, exportedValue);
                return;
            }
        }
    }

    throw new Error('Failed to find React module with useRef');
}
