import type { Map as MapLibreInstance } from 'maplibre-gl';
import { BPLACE_PLATFORM } from './bplace/hooks';
import type { CanvasPlatform, PixelColor } from './types';
import { WPLACE_PLATFORM } from './wplace/hooks';

let mapInstance: MapLibreInstance | null = null;
let hookAdded = false;
const { resolve: resolveMapInstance, promise: mapInstancePromise } = Promise.withResolvers<MapLibreInstance>();

let availableColors: PixelColor[] | null = null;

const ACTIVE_PLATFORM = resolvePlatform();

function resolvePlatform(): CanvasPlatform {
    const currentOrigin = window.location.origin;
    switch (currentOrigin) {
        case 'https://bplace.art':
            return BPLACE_PLATFORM;
        case 'https://wplace.live':
            return WPLACE_PLATFORM;
        default:
            throw new Error(`Unsupported platform with origin ${currentOrigin}`);
    }
}

export const Platform = {
    initialize(): void {
        ACTIVE_PLATFORM.insertPlatformStyles();
    },

    async addMapInstanceHook(): Promise<void> {
        if (hookAdded) {
            return;
        }

        hookAdded = true;
        await ACTIVE_PLATFORM.addMapInstanceHook((instance) => {
            mapInstance = instance;
            resolveMapInstance(instance);
        });
    },

    async waitForMapInstance(): Promise<MapLibreInstance> {
        return mapInstancePromise;
    },

    getMapInstance(): MapLibreInstance {
        if (mapInstance == null) {
            throw new Error('Map instance is not available yet. Please call waitForMapInstance() first.');
        }

        return mapInstance;
    },

    async getAvailableColors(): Promise<PixelColor[]> {
        availableColors ??= await ACTIVE_PLATFORM.getAvailableColors();
        return availableColors;
    },

    async getCurrentColor(): Promise<PixelColor | null> {
        const colors = await this.getAvailableColors();
        return ACTIVE_PLATFORM.getCurrentColor(colors);
    },
};
