import { type Map as MapLibreInstance, MercatorCoordinate } from 'maplibre-gl';
import { debug } from '../core/debug';
import type { HTMLElementChild } from '../core/dom/html';
import { addStyles } from '../core/dom/styles';
import { NetworkInterceptor } from '../core/network-interceptor';
import { TemplateRegistry } from '../core/template/template-registry';
import { dialogStyle } from '../ui/builtin/dialog';
import { inputStyle } from '../ui/builtin/input';
import { mdiIconStyle } from '../ui/builtin/mdi-icon';
import { popoverMenuStyle } from '../ui/builtin/popover-menu';
import { alertsContainerStyle } from '../ui/components/alerts-container';
import { appIconStyle } from '../ui/components/app-icon';
import { appViewStyle } from '../ui/components/app-view';
import { confirmationDialogStyle } from '../ui/dialogs/confirmation-dialog';
import { imagePaletteDiffDialogStyle } from '../ui/dialogs/image-palette-diff-dialog';
import { newTemplateDialogStyle } from '../ui/dialogs/new-template-dialog';
import { settingsDialogStyle } from '../ui/dialogs/settings-dialog';
import { templateNameDialogStyle } from '../ui/dialogs/template-name-dialog';
import type { Point } from '../util/geometry';
import { BplacePlatform } from './bplace/platform';
import platformStyle from './platform.css';
import { createSetting, createSettings } from './settings';
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

export const PlatformSettings = createSettings('platform', 1, {
    debug: createSetting(false),
    debugLogSize: createSetting(100, [(_, newValue): void => console.log('would resize debug log to', newValue)]),
});

export const Platform = {
    get colors(): readonly PixelColor[] {
        return activePlatform.colors;
    },

    async initPlatform(): Promise<void> {
        await PlatformSettings.init();

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
            confirmationDialogStyle,
            popoverMenuStyle,
            dialogStyle,
            templateNameDialogStyle,
        );
        await activePlatform.initialize();
    },

    async initTemplateFunctionality(): Promise<void> {
        await TemplateRegistry.initialize();
    },

    async addMapInstanceHook(): Promise<void> {
        if (hookAdded) {
            return;
        }

        hookAdded = true;

        debug('Adding map instance hook');
        await activePlatform.addMapInstanceHook((instance) => {
            mapInstance = instance;
            debug('Map instance captured');
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

    getViewportCenterPixel(): Point {
        const map = Platform.getCurrentMapInstance();
        const viewportCenter = MercatorCoordinate.fromLngLat(map.getCenter());
        return {
            x: viewportCenter.x * activePlatform.canvasSizePixels.width,
            y: viewportCenter.y * activePlatform.canvasSizePixels.height,
        };
    },

    // latLonToPixel(mapPosition: MapPoint): Point {
    //     // todo
    // },
    //
    // pixelToLatLon(position: Point): MapPoint {
    //     // todo
    // },
};
