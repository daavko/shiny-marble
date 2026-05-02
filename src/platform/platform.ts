import type { LngLat, LngLatLike, Map as MapLibreInstance } from 'maplibre-gl';
import type { HTMLElementChild } from '../core/dom/html';
import { addStyles } from '../core/dom/styles';
import { NetworkInterceptor } from '../core/network-interceptor';
import type { PixelColor } from '../core/types';
import { buttonStyle } from '../ui/builtin/button';
import { dialogStyle } from '../ui/builtin/dialog';
import { inputStyle } from '../ui/builtin/input';
import { mdiIconStyle } from '../ui/builtin/mdi-icon';
import { popoverMenuStyle } from '../ui/builtin/popover-menu';
import { tooltipStyle } from '../ui/builtin/tooltip';
import { activeToolPanelStyle, openActiveToolPanel } from '../ui/components/active-tool-panel';
import { alertsContainerStyle } from '../ui/components/alerts-container';
import { appIconStyle } from '../ui/components/app-icon';
import { appViewStyle } from '../ui/components/app-view';
import { templateImagePickerStyle } from '../ui/components/template-image-picker';
import { settingsDialogStyle } from '../ui/dialogs/settings-dialog';
import { templateListDialogStyle } from '../ui/dialogs/template-list-dialog';
import {
    type MapTileCoordinates,
    type MapTileExtent,
    type PixelCoordinates,
    pixelCoordinates,
    type PixelDimensions,
    type RenderTileDimensions,
} from '../util/geometry';
import { MercatorCoordinate } from '../vendor/maplibre/geo/mercator-coordinate';
import { BplacePlatform } from './bplace/platform';
import { debug } from './debug';
import { worldWrapPixelCoordinates } from './geometry';
import platformStyle from './platform.css';
import type { EffectContext } from './reactivity/effects';
import { signal } from './reactivity/signals';
import { createSetting, createSettings } from './settings';
import { TemplateRegistry } from './template/registry';
import { canvasSnapshotToolStyle } from './tools/canvas-snapshot';
import type { ActiveTool, CanvasPlatform } from './types';
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

const activeTool = signal<ActiveTool | null>(null);

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

    get canvasRenderTileDimensions(): RenderTileDimensions {
        return activePlatform.canvasRenderTileDimensions;
    },

    get mapTilePixelDimensions(): PixelDimensions {
        return activePlatform.mapTilePixelDimensions;
    },

    get renderTilePixelDimensions(): PixelDimensions {
        return activePlatform.renderTilePixelDimensions;
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
            activeToolPanelStyle,
            canvasSnapshotToolStyle,
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
        return Platform.latLonToPixel(map.getCenter(), 'round');
    },

    mercatorToPixel(
        mercatorCoord: MercatorCoordinate,
        adjust: 'floor' | 'round' | 'ceil',
        worldWrap = true,
    ): PixelCoordinates {
        const rawX = mercatorCoord.x * activePlatform.canvasPixelDimensions.width;
        const rawY = mercatorCoord.y * activePlatform.canvasPixelDimensions.height;
        let ret: PixelCoordinates;
        switch (adjust) {
            case 'floor':
                ret = pixelCoordinates({ x: Math.floor(rawX), y: Math.floor(rawY) });
                break;
            case 'round':
                ret = pixelCoordinates({ x: Math.round(rawX), y: Math.round(rawY) });
                break;
            case 'ceil':
                ret = pixelCoordinates({ x: Math.ceil(rawX), y: Math.ceil(rawY) });
                break;
        }
        if (worldWrap) {
            ret = worldWrapPixelCoordinates(ret);
        }
        return ret;
    },

    latLonToPixel(mapPosition: LngLatLike, adjust: 'floor' | 'round' | 'ceil', worldWrap = true): PixelCoordinates {
        return Platform.mercatorToPixel(MercatorCoordinate.fromLngLat(mapPosition), adjust, worldWrap);
    },

    /**
     * automatically handles world wrapping
     */
    pixelToMercator(position: PixelCoordinates, worldWrapping = true): MercatorCoordinate {
        if (worldWrapping) {
            position = worldWrapPixelCoordinates(position);
        }
        const x = position.x / activePlatform.canvasPixelDimensions.width;
        const y = position.y / activePlatform.canvasPixelDimensions.height;
        return new MercatorCoordinate(x, y);
    },

    /**
     * automatically handles world wrapping
     */
    pixelToLatLon(position: PixelCoordinates, worldWrapping = true): LngLat {
        return Platform.pixelToMercator(position, worldWrapping).toLngLat();
    },

    async requestToolActivation(tool: ActiveTool): Promise<void> {
        if (activeTool.value) {
            await activeTool.value.close();
        }
        const toolPanel = openActiveToolPanel();
        activeTool.value = tool;
        await tool.activate(toolPanel);
        toolPanel.effectContext.registerCleanup(() => {
            if (activeTool.value === tool) {
                activeTool.value = null;
            }
        });
    },

    async fetchTileImage(tileCoords: MapTileCoordinates): Promise<ImageBitmap | null> {
        return activePlatform.fetchTileImage(tileCoords);
    },

    /**
     * extent HAS TO be non-wrappable, meaning it can't cross the world seam
     */
    createTilesRegionGenerator(
        extent: MapTileExtent,
    ): AsyncGenerator<{ tileCoords: MapTileCoordinates; tileBitmap: ImageBitmap | null }> {
        return activePlatform.createTilesRegionGenerator(extent);
    },
};
