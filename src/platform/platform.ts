import type { Map as MapLibreInstance } from 'maplibre-gl';
import { debug, resizeDebugLog } from '../core/debug';
import type { HTMLElementChild } from '../core/dom/html';
import { addStyles } from '../core/dom/styles';
import { NetworkInterceptor } from '../core/network-interceptor';
import { alertsContainerStyle } from '../ui/alerts-container';
import { appIconStyle } from '../ui/app-icon';
import { appViewStyle } from '../ui/app-view';
import { imagePaletteDiffDialogStyle } from '../ui/dialogs/image-palette-diff-dialog';
import { newTemplateDialogStyle } from '../ui/dialogs/new-template-dialog';
import { settingsDialogStyle } from '../ui/dialogs/settings-dialog';
import { inputStyle } from '../ui/input';
import { mdiIconStyle } from '../ui/mdi-icon';
import { BplacePlatform } from './bplace/platform';
import platformStyle from './platform.css';
import { BooleanSetting, NumberSetting, Settings } from './settings';
import type { CanvasPlatform, PixelColor } from './types';
import { WplacePlatform } from './wplace/platform';

let mapInstance: MapLibreInstance | null = null;
let hookAdded = false;
const { resolve: resolveMapInstance, promise: mapInstancePromise } = Promise.withResolvers<MapLibreInstance>();

const activePlatform = ((): CanvasPlatform => {
    const currentOrigin = window.location.origin;
    switch (currentOrigin) {
        case 'https://bplace.art':
            return BplacePlatform;
        case 'https://wplace.live':
            return WplacePlatform;
        default:
            throw new Error(`Unsupported platform with origin ${currentOrigin}`);
    }
})();

export const PlatformSettings = Settings.create('platform', {
    debug: new BooleanSetting(false),
    debugLogSize: new NumberSetting(100, [(_, newValue): void => resizeDebugLog(newValue)]),
});

export const Platform = {
    get colors(): readonly PixelColor[] {
        return activePlatform.colors;
    },

    initPlatform(): void {
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
            imagePaletteDiffDialogStyle,
        );
        activePlatform.initialize();
    },

    async addMapInstanceHook(): Promise<void> {
        if (hookAdded) {
            return;
        }

        hookAdded = true;

        debug('Adding map instance hook');
        await activePlatform.addMapInstanceHook((instance) => {
            mapInstance = instance;
            debug('Map instance captured', instance);
            resolveMapInstance(instance);
        });
    },

    async waitForMapInstance(): Promise<MapLibreInstance> {
        return mapInstancePromise;
    },

    getCurrentMapInstance(): MapLibreInstance {
        if (mapInstance == null) {
            throw new Error('Map instance is not available yet. Please call waitForMapInstance() first.');
        }

        return mapInstance;
    },

    getCurrentColor(): PixelColor | null {
        const colors = activePlatform.colors;
        return activePlatform.getCurrentColor(colors);
    },

    renderPlatformSpecificAppViewContent(): HTMLElementChild | HTMLElementChild[] | null {
        return activePlatform.renderPlatformSpecificAppViewContent();
    },

    renderPlatformSpecificSettingsContent(destroyPromise: Promise<void>): HTMLElementChild | HTMLElementChild[] | null {
        return activePlatform.renderPlatformSpecificSettingsContent(destroyPromise);
    },

    // latLonToPixel(mapPosition: MapPoint): Point {
    //     // todo
    // },
    //
    // pixelToLatLon(position: Point): MapPoint {
    //     // todo
    // },
};
