import type { Map as MapLibreInstance } from 'maplibre-gl';
import type { HTMLElementChild } from '../core/dom/html';
import { addStyles } from '../core/dom/styles';
import { NetworkInterceptor } from '../core/network-interceptor';
import { alertsContainerStyle } from '../ui/alerts-container';
import { appIconStyle } from '../ui/app-icon';
import { appViewStyle } from '../ui/app-view';
import { newTemplateDialogStyle } from '../ui/dialogs/new-template-dialog';
import { settingsDialogStyle } from '../ui/dialogs/settings-dialog';
import { inputStyle } from '../ui/input';
import { mdiIconStyle } from '../ui/mdi-icon';
import type { MapPoint, Point } from '../util/geometry';
import { BplacePlatform } from './bplace/platform';
import { debug } from './debug';
import platformStyle from './platform.css';
import { BooleanSetting, Settings } from './settings';
import type { CanvasPlatform, PixelColor } from './types';
import { WplacePlatform } from './wplace/platform';

let mapInstance: MapLibreInstance | null = null;
let hookAdded = false;
const { resolve: resolveMapInstance, promise: mapInstancePromise } = Promise.withResolvers<MapLibreInstance>();

const platformSettings = Settings.create('platform', {
    debug: new BooleanSetting(false),
});

const ACTIVE_PLATFORM = resolvePlatform();

function resolvePlatform(): CanvasPlatform {
    const currentOrigin = window.location.origin;
    switch (currentOrigin) {
        case 'https://bplace.art':
            return BplacePlatform;
        case 'https://wplace.live':
            return WplacePlatform;
        default:
            throw new Error(`Unsupported platform with origin ${currentOrigin}`);
    }
}

export const Platform = {
    get colors(): readonly PixelColor[] {
        return ACTIVE_PLATFORM.colors;
    },

    get settings(): typeof platformSettings {
        return platformSettings;
    },

    initialize(): void {
        NetworkInterceptor.init();
        addStyles(
            platformStyle,
            alertsContainerStyle,
            appIconStyle,
            mdiIconStyle,
            appViewStyle,
            settingsDialogStyle,
            inputStyle,
            newTemplateDialogStyle,
        );
        ACTIVE_PLATFORM.initialize();
    },

    async addMapInstanceHook(): Promise<void> {
        if (hookAdded) {
            return;
        }

        hookAdded = true;

        debug('Adding map instance hook');
        await ACTIVE_PLATFORM.addMapInstanceHook((instance) => {
            mapInstance = instance;
            debug('Map instance captured', instance);
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

    renderPlatformSpecificSettingsContent(destroyPromise: Promise<void>): HTMLElementChild | HTMLElementChild[] | null {
        return ACTIVE_PLATFORM.renderPlatformSpecificSettingsContent(destroyPromise);
    },

    latLonToPixel(mapPosition: MapPoint): Point {
        // todo
    },

    pixelToLatLon(position: Point): MapPoint {},
};
