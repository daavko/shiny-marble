import type { Map as MapLibreInstance } from 'maplibre-gl';
import type { HTMLElementChild } from '../dom/html';
import { addStyles } from '../dom/styles';
import { alertsContainerStyle } from '../ui/alerts-container';
import { appIconStyle } from '../ui/app-icon';
import { appViewStyle } from '../ui/app-view';
import { mdiIconStyle } from '../ui/mdi-icon';
import { BPLACE_PLATFORM } from './bplace/platform';
import platformStyle from './platform.css';
import type { CanvasPlatform, PixelColor } from './types';
import { WPLACE_PLATFORM } from './wplace/platform';

let mapInstance: MapLibreInstance | null = null;
let hookAdded = false;
const { resolve: resolveMapInstance, promise: mapInstancePromise } = Promise.withResolvers<MapLibreInstance>();

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
    get colors(): readonly PixelColor[] {
        return ACTIVE_PLATFORM.colors;
    },

    initialize(): void {
        addStyles(...ACTIVE_PLATFORM.styles);
        addStyles(platformStyle, alertsContainerStyle, appIconStyle, mdiIconStyle, appViewStyle);
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

    getCurrentColor(): PixelColor | null {
        const colors = ACTIVE_PLATFORM.colors;
        return ACTIVE_PLATFORM.getCurrentColor(colors);
    },

    renderPlatformSpecificAppViewContent(): HTMLElementChild | HTMLElementChild[] | null {
        return ACTIVE_PLATFORM.renderPlatformSpecificAppViewContent();
    },
};
