import { type LngLatLike, type Map as MapLibreInstance, MercatorCoordinate } from 'maplibre-gl';
import { debug } from '../core/debug';
import type { HTMLElementChild } from '../core/dom/html';
import { addStyles } from '../core/dom/styles';
import type { EffectContext } from '../core/effects';
import { NetworkInterceptor } from '../core/network-interceptor';
import { TemplateRegistry } from '../core/template/registry';
import { buttonStyle } from '../ui/builtin/button';
import { dialogStyle } from '../ui/builtin/dialog';
import { inputStyle } from '../ui/builtin/input';
import { mdiIconStyle } from '../ui/builtin/mdi-icon';
import { popoverMenuStyle } from '../ui/builtin/popover-menu';
import { tooltipStyle } from '../ui/builtin/tooltip';
import { alertsContainerStyle } from '../ui/components/alerts-container';
import { appIconStyle } from '../ui/components/app-icon';
import { appViewStyle } from '../ui/components/app-view';
import { templateImagePickerStyle } from '../ui/components/template-image-picker';
import { settingsDialogStyle } from '../ui/dialogs/settings-dialog';
import { templateListDialogStyle } from '../ui/dialogs/template-list-dialog';
import { pixelCoordinates, type PixelCoordinates, type PixelDimensions } from '../util/geometry';
import { BplacePlatform } from './bplace/platform';
import platformStyle from './platform.css';
import { createSetting, createSettings } from './settings';
import type { CanvasPlatform, PixelColor } from './types';
import utilStyle from './util.css';
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
    debug: createSetting(true),
    debugLogSize: createSetting(100, [(newValue): void => console.log('would resize debug log to', newValue)]),
});

export const Platform = {
    get id(): string {
        return activePlatform.id;
    },

    get colors(): readonly PixelColor[] {
        return activePlatform.colors;
    },

    get colorsVersion(): number {
        return activePlatform.colorsVersion;
    },

    get canvasPixelDimensions(): PixelDimensions {
        return activePlatform.canvasPixelDimensions;
    },

    get tileDimensions(): PixelDimensions {
        return activePlatform.tileDimensions;
    },

    async initPlatform(): Promise<void> {
        await PlatformSettings.init();
        debug('Initializing platform');

        NetworkInterceptor.init();
        addStyles(
            platformStyle,
            utilStyle,
            alertsContainerStyle,
            appIconStyle,
            mdiIconStyle,
            buttonStyle,
            appViewStyle,
            settingsDialogStyle,
            inputStyle,
            popoverMenuStyle,
            dialogStyle,
            templateImagePickerStyle,
            templateListDialogStyle,
            tooltipStyle,
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

    renderPlatformSpecificSettingsContent(context: EffectContext): HTMLElementChild | HTMLElementChild[] | null {
        return activePlatform.renderPlatformSpecificSettingsContent(context);
    },

    getViewportCenterPixel(): PixelCoordinates {
        const map = Platform.getCurrentMapInstance();
        return Platform.latLonToPixel(map.getCenter());
    },

    latLonToPixel(mapPosition: LngLatLike, adjust: 'floor' | 'round' | 'ceil' = 'round'): PixelCoordinates {
        const mercatorCoord = MercatorCoordinate.fromLngLat(mapPosition);
        const rawX = mercatorCoord.x * activePlatform.canvasPixelDimensions.width;
        const rawY = mercatorCoord.y * activePlatform.canvasPixelDimensions.height;
        switch (adjust) {
            case 'floor':
                return pixelCoordinates({ x: Math.floor(rawX), y: Math.floor(rawY) });
            case 'round':
                return pixelCoordinates({ x: Math.round(rawX), y: Math.round(rawY) });
            case 'ceil':
                return pixelCoordinates({ x: Math.ceil(rawX), y: Math.ceil(rawY) });
        }
    },

    // latLonToPixel(mapPosition: MapPoint): Point {
    //     // todo
    // },
    //
    // pixelToLatLon(position: Point): MapPoint {
    //     // todo
    // },
};
